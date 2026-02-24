"""
AICaffe News Aggregator - AI news scraping, curation, and feed management
"""
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
import os
import uuid

app = FastAPI(title="AICaffe News Aggregator", version="1.0.0")

# ── Schemas ────────────────────────────────────────────────────────

class NewsSourceCreate(BaseModel):
    name: str
    website_url: str
    feed_url: Optional[str] = None
    source_type: str = "rss"
    category: Optional[str] = None

class ArticleResponse(BaseModel):
    id: str
    title: str
    summary: Optional[str]
    original_url: str
    author: Optional[str]
    image_url: Optional[str]
    source_name: str
    categories: List[str]
    tags: List[str]
    sentiment: Optional[str]
    view_count: int
    published_at: Optional[datetime]

# ── Database (Singleton) ───────────────────────────────────────────

import asyncpg

_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", 5432)),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "postgres"),
            database=os.getenv("DB_NAME", "aicaffe"),
            min_size=2,
            max_size=10,
        )
    return _pool

@app.on_event("shutdown")
async def shutdown():
    global _pool
    if _pool:
        await _pool.close()

# ── Predefined News Sources ───────────────────────────────────────

DEFAULT_SOURCES = [
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/", "type": "scrape", "category": "tech"},
    {"name": "The Verge AI", "url": "https://www.theverge.com/ai-artificial-intelligence", "type": "scrape", "category": "tech"},
    {"name": "VentureBeat AI", "url": "https://venturebeat.com/category/ai/", "type": "scrape", "category": "enterprise"},
    {"name": "MIT Technology Review AI", "url": "https://www.technologyreview.com/topic/artificial-intelligence/", "type": "scrape", "category": "research"},
    {"name": "AI News", "url": "https://www.artificialintelligence-news.com/", "type": "rss", "category": "general"},
    {"name": "Hacker News AI", "url": "https://hn.algolia.com/api/v1/search_by_date?tags=story&query=AI", "type": "api", "category": "community"},
    {"name": "ArXiv AI", "url": "https://arxiv.org/list/cs.AI/recent", "type": "scrape", "category": "research"},
    {"name": "OpenAI Blog", "url": "https://openai.com/blog", "type": "scrape", "category": "provider"},
    {"name": "Anthropic News", "url": "https://www.anthropic.com/news", "type": "scrape", "category": "provider"},
    {"name": "Google AI Blog", "url": "https://blog.google/technology/ai/", "type": "scrape", "category": "provider"},
    {"name": "Hugging Face Blog", "url": "https://huggingface.co/blog", "type": "scrape", "category": "community"},
    {"name": "Reddit r/MachineLearning", "url": "https://www.reddit.com/r/MachineLearning/.json", "type": "api", "category": "community"},
]

# ── Routes ─────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "news-aggregator"}

# ── News Feed ──────────────────────────────────────────────────────

@app.get("/api/v1/news/feed")
async def get_news_feed(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    provider_slug: Optional[str] = None,
    search: Optional[str] = None,
    sentiment: Optional[str] = None,
    featured_only: bool = False,
    days: int = Query(7, ge=1, le=90),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    """Get AI news feed with filters"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        conditions = ["a.published_at > NOW() - INTERVAL '1 day' * $1"]
        params = [days]
        idx = 2

        if category:
            conditions.append(f"$${idx} = ANY(a.categories)")
            params.append(category)
            idx += 1
        if tag:
            conditions.append(f"${idx} = ANY(a.tags)")
            params.append(tag)
            idx += 1
        if search:
            conditions.append(f"(a.title ILIKE ${idx} OR a.summary ILIKE ${idx})")
            params.append(f"%{search}%")
            idx += 1
        if sentiment:
            conditions.append(f"a.sentiment = ${idx}")
            params.append(sentiment)
            idx += 1
        if featured_only:
            conditions.append("a.is_featured = TRUE")

        where = " AND ".join(conditions)
        offset = (page - 1) * page_size
        params.extend([page_size, offset])

        articles = await conn.fetch(
            f"""SELECT a.*, s.name as source_name, s.category as source_category
                FROM news_articles a
                JOIN news_sources s ON a.source_id = s.id
                WHERE {where}
                ORDER BY a.is_breaking DESC, a.published_at DESC
                LIMIT ${idx} OFFSET ${idx + 1}""",
            *params
        )

        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM news_articles a JOIN news_sources s ON a.source_id = s.id WHERE {where}",
            *params[:-2]
        )

        return {
            "articles": [dict(a) for a in articles],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

@app.get("/api/v1/news/trending")
async def get_trending(limit: int = 10):
    """Get trending AI news (most viewed in last 24h)"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        articles = await conn.fetch(
            """SELECT a.*, s.name as source_name
               FROM news_articles a
               JOIN news_sources s ON a.source_id = s.id
               WHERE a.published_at > NOW() - INTERVAL '24 hours'
               ORDER BY a.view_count DESC, a.share_count DESC
               LIMIT $1""",
            limit
        )
        return {"trending": [dict(a) for a in articles]}

@app.get("/api/v1/news/breaking")
async def get_breaking_news():
    """Get breaking AI news"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        articles = await conn.fetch(
            """SELECT a.*, s.name as source_name
               FROM news_articles a
               JOIN news_sources s ON a.source_id = s.id
               WHERE a.is_breaking = TRUE AND a.published_at > NOW() - INTERVAL '48 hours'
               ORDER BY a.published_at DESC LIMIT 10"""
        )
        return {"breaking_news": [dict(a) for a in articles]}

# ── Bookmarks ──────────────────────────────────────────────────────

@app.post("/api/v1/news/{article_id}/bookmark")
async def bookmark_article(article_id: str, user_id: str = "current-user"):
    pool = await get_pool()
    async with pool.acquire() as conn:
        bm_id = str(uuid.uuid4())
        await conn.execute(
            """INSERT INTO news_bookmarks (id, user_id, article_id)
               VALUES ($1, $2, $3) ON CONFLICT (user_id, article_id) DO NOTHING""",
            bm_id, user_id, article_id
        )
        await conn.execute(
            "UPDATE news_articles SET bookmark_count = bookmark_count + 1 WHERE id = $1", article_id
        )
        return {"message": "Article bookmarked"}

@app.get("/api/v1/news/bookmarks/mine")
async def get_my_bookmarks(user_id: str = "current-user", page: int = 1, page_size: int = 20):
    pool = await get_pool()
    async with pool.acquire() as conn:
        offset = (page - 1) * page_size
        bookmarks = await conn.fetch(
            """SELECT a.*, s.name as source_name, b.created_at as bookmarked_at
               FROM news_bookmarks b
               JOIN news_articles a ON b.article_id = a.id
               JOIN news_sources s ON a.source_id = s.id
               WHERE b.user_id = $1
               ORDER BY b.created_at DESC
               LIMIT $2 OFFSET $3""",
            user_id, page_size, offset
        )
        return {"bookmarks": [dict(b) for b in bookmarks]}

# ── Provider-specific News ─────────────────────────────────────────

@app.get("/api/v1/news/provider/{provider_slug}")
async def get_provider_news(provider_slug: str, limit: int = 10):
    """Get latest news about a specific AI provider"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Search by tag or title mention
        articles = await conn.fetch(
            """SELECT a.*, s.name as source_name
               FROM news_articles a
               JOIN news_sources s ON a.source_id = s.id
               WHERE $1 = ANY(a.tags) OR a.title ILIKE $2
               ORDER BY a.published_at DESC
               LIMIT $3""",
            provider_slug, f"%{provider_slug}%", limit
        )
        return {"articles": [dict(a) for a in articles], "provider": provider_slug}

# ── News Sources Management ────────────────────────────────────────

@app.get("/api/v1/news/sources")
async def list_sources():
    pool = await get_pool()
    async with pool.acquire() as conn:
        sources = await conn.fetch(
            "SELECT *, (SELECT COUNT(*) FROM news_articles WHERE source_id = news_sources.id) as article_count FROM news_sources ORDER BY name"
        )
        return {"sources": [dict(s) for s in sources]}

# ── Scraper Trigger (internal/admin) ───────────────────────────────

@app.post("/api/v1/news/scrape")
async def trigger_scrape(source_id: Optional[str] = None):
    """Trigger news scraping (admin only, called by scheduler)"""
    # In production, this would trigger actual scraping jobs
    return {
        "message": "Scrape job triggered",
        "source_id": source_id or "all",
        "status": "queued",
    }

# ── AI News Summary ───────────────────────────────────────────────

@app.get("/api/v1/news/daily-digest")
async def daily_digest():
    """Get AI-generated daily digest of top AI news"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        top_articles = await conn.fetch(
            """SELECT a.title, a.summary, s.name as source_name, a.categories
               FROM news_articles a
               JOIN news_sources s ON a.source_id = s.id
               WHERE a.published_at > NOW() - INTERVAL '24 hours'
               ORDER BY a.view_count DESC
               LIMIT 10"""
        )
        categories_today = await conn.fetch(
            """SELECT UNNEST(categories) as category, COUNT(*) as count
               FROM news_articles
               WHERE published_at > NOW() - INTERVAL '24 hours'
               GROUP BY category
               ORDER BY count DESC
               LIMIT 5"""
        )
        return {
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "top_stories": [dict(a) for a in top_articles],
            "trending_topics": [dict(c) for c in categories_today],
            "total_articles_today": await conn.fetchval(
                "SELECT COUNT(*) FROM news_articles WHERE published_at > NOW() - INTERVAL '24 hours'"
            ),
        }

# NOTE: This route MUST be defined AFTER all other /api/v1/news/* routes
# to avoid path conflict where "sources", "trending", etc. are matched as {article_id}
@app.get("/api/v1/news/{article_id}")
async def get_article(article_id: str):
    """Get full article details"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        article = await conn.fetchrow(
            """SELECT a.*, s.name as source_name, s.website_url as source_url
               FROM news_articles a JOIN news_sources s ON a.source_id = s.id
               WHERE a.id = $1""",
            article_id
        )
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        # Increment view count
        await conn.execute(
            "UPDATE news_articles SET view_count = view_count + 1 WHERE id = $1", article_id
        )
        # Get related articles
        related = await conn.fetch(
            """SELECT id, title, image_url, published_at
               FROM news_articles
               WHERE id != $1 AND tags && $2
               ORDER BY published_at DESC LIMIT 5""",
            article_id, article["tags"]
        )
        return {"article": dict(article), "related": [dict(r) for r in related]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
