"""
AICaffe Model Registry Service - AI model catalog, comparison, and search
"""
from fastapi import FastAPI, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import os
import uuid

app = FastAPI(title="AICaffe Model Registry", version="1.0.0")

# ── Enums ──────────────────────────────────────────────────────────

class ModelType(str, Enum):
    LLM = "llm"
    IMAGE_GENERATION = "image_generation"
    VIDEO_GENERATION = "video_generation"
    AUDIO_GENERATION = "audio_generation"
    AUDIO_TRANSCRIPTION = "audio_transcription"
    TEXT_TO_SPEECH = "text_to_speech"
    CODE_GENERATION = "code_generation"
    EMBEDDING = "embedding"
    MULTIMODAL = "multimodal"
    SEARCH = "search"

class SortBy(str, Enum):
    RATING = "avg_rating"
    PRICE_LOW = "input_price_per_million"
    POPULARITY = "total_api_calls"
    SPEED = "avg_latency_ms"
    CONTEXT = "context_window"
    NEWEST = "released_at"

# ── Schemas ────────────────────────────────────────────────────────

class ProviderResponse(BaseModel):
    id: str
    name: str
    slug: str
    logo_url: Optional[str]
    website: Optional[str]
    description: Optional[str]
    headquarters: Optional[str]
    model_count: int = 0
    status: str

class ModelSummary(BaseModel):
    id: str
    name: str
    slug: str
    provider_name: str
    provider_slug: str
    model_type: str
    short_description: Optional[str]
    context_window: Optional[int]
    input_price_per_million: Optional[float]
    output_price_per_million: Optional[float]
    avg_rating: float
    total_ratings: int
    is_open_source: bool
    is_featured: bool
    capabilities: dict

class ModelDetail(ModelSummary):
    version: Optional[str]
    model_identifier: str
    description: Optional[str]
    max_output_tokens: Optional[int]
    training_cutoff: Optional[str]
    parameters_count: Optional[str]
    architecture: Optional[str]
    benchmarks: dict
    avg_latency_ms: Optional[int]
    avg_tokens_per_second: Optional[int]
    uptime_percentage: float
    license_type: Optional[str]
    features: List[dict]
    pricing_tiers: List[dict]
    released_at: Optional[datetime]

class ModelComparisonRequest(BaseModel):
    model_ids: List[str] = Field(min_length=2, max_length=5)

class ModelComparisonResponse(BaseModel):
    models: List[ModelDetail]
    comparison_matrix: Dict[str, Any]
    recommendation: Optional[Dict[str, Any]]

class ReviewCreate(BaseModel):
    model_id: str
    rating: int = Field(ge=1, le=5)
    title: Optional[str]
    review_text: Optional[str]
    use_case_slug: Optional[str]
    pros: List[str] = []
    cons: List[str] = []

# ── Database Pool (Singleton) ─────────────────────────────────────

import asyncpg

class Database:
    """Database interface - singleton connection pool"""
    _pool = None

    @classmethod
    async def get_pool(cls):
        if cls._pool is None:
            cls._pool = await asyncpg.create_pool(
                host=os.getenv("DB_HOST", "localhost"),
                port=int(os.getenv("DB_PORT", 5432)),
                user=os.getenv("DB_USER", "postgres"),
                password=os.getenv("DB_PASSWORD", "postgres"),
                database=os.getenv("DB_NAME", "aicaffe"),
                min_size=2,
                max_size=10,
            )
        return cls._pool

    @classmethod
    async def close_pool(cls):
        if cls._pool:
            await cls._pool.close()
            cls._pool = None

db = Database()

async def get_pool():
    return await db.get_pool()

@app.on_event("shutdown")
async def shutdown():
    await db.close_pool()

# ── Routes ─────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "model-registry"}

# ── Providers ──────────────────────────────────────────────────────

@app.get("/api/v1/providers")
async def list_providers(
    status: Optional[str] = "active",
    search: Optional[str] = None,
):
    """List all AI providers with model counts"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT p.*, COUNT(m.id) as model_count
            FROM ai_providers p
            LEFT JOIN ai_models m ON m.provider_id = p.id AND m.status = 'active'
            WHERE p.status = $1
        """
        params = [status]
        if search:
            query += " AND (p.name ILIKE $2 OR p.description ILIKE $2)"
            params.append(f"%{search}%")
        query += " GROUP BY p.id ORDER BY model_count DESC"
        providers = await conn.fetch(query, *params)
        return {"providers": [dict(p) for p in providers], "total": len(providers)}

@app.get("/api/v1/providers/{slug}")
async def get_provider(slug: str):
    """Get provider details with all models"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        provider = await conn.fetchrow(
            "SELECT * FROM ai_providers WHERE slug = $1", slug
        )
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        models = await conn.fetch(
            """SELECT m.*, p.name as provider_name, p.slug as provider_slug
               FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id
               WHERE m.provider_id = $1 AND m.status = 'active'
               ORDER BY m.is_featured DESC, m.avg_rating DESC""",
            provider["id"]
        )
        return {"provider": dict(provider), "models": [dict(m) for m in models]}

# ── Models ─────────────────────────────────────────────────────────

@app.get("/api/v1/models")
async def list_models(
    model_type: Optional[ModelType] = None,
    provider_slug: Optional[str] = None,
    is_open_source: Optional[bool] = None,
    is_featured: Optional[bool] = None,
    min_context: Optional[int] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    sort_by: SortBy = SortBy.RATING,
    sort_order: str = "DESC",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    capabilities: Optional[str] = None,
):
    """List and filter AI models with pagination"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        conditions = ["m.status = 'active'"]
        params = []
        idx = 1

        if model_type:
            conditions.append(f"m.model_type = ${idx}")
            params.append(model_type.value)
            idx += 1
        if provider_slug:
            conditions.append(f"p.slug = ${idx}")
            params.append(provider_slug)
            idx += 1
        if is_open_source is not None:
            conditions.append(f"m.is_open_source = ${idx}")
            params.append(is_open_source)
            idx += 1
        if is_featured is not None:
            conditions.append(f"m.is_featured = ${idx}")
            params.append(is_featured)
            idx += 1
        if min_context:
            conditions.append(f"m.context_window >= ${idx}")
            params.append(min_context)
            idx += 1
        if max_price:
            conditions.append(f"m.input_price_per_million <= ${idx}")
            params.append(max_price)
            idx += 1
        if search:
            conditions.append(f"(m.name ILIKE ${idx} OR m.description ILIKE ${idx} OR p.name ILIKE ${idx})")
            params.append(f"%{search}%")
            idx += 1

        where_clause = " AND ".join(conditions)
        offset = (page - 1) * page_size

        # Count total
        count_query = f"SELECT COUNT(*) FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id WHERE {where_clause}"
        total = await conn.fetchval(count_query, *params)

        # Fetch models
        sort_col = sort_by.value
        query = f"""
            SELECT m.*, p.name as provider_name, p.slug as provider_slug, p.logo_url as provider_logo
            FROM ai_models m
            JOIN ai_providers p ON m.provider_id = p.id
            WHERE {where_clause}
            ORDER BY m.{sort_col} {sort_order} NULLS LAST
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        params.extend([page_size, offset])
        models = await conn.fetch(query, *params)

        return {
            "models": [dict(m) for m in models],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

# NOTE: Leaderboard must come BEFORE {model_id} route to avoid path conflict
@app.get("/api/v1/models/leaderboard")
async def model_leaderboard(
    model_type: Optional[ModelType] = None,
    metric: str = "overall",
    limit: int = 20,
):
    """Get model leaderboard by various metrics"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        condition = "WHERE m.status = 'active'"
        params = []
        if model_type:
            condition += " AND m.model_type = $1"
            params.append(model_type.value)

        order_by = {
            "overall": "m.avg_rating DESC, m.total_api_calls DESC",
            "speed": "m.avg_latency_ms ASC NULLS LAST",
            "price": "m.input_price_per_million ASC NULLS LAST",
            "context": "m.context_window DESC NULLS LAST",
            "popularity": "m.total_api_calls DESC",
        }.get(metric, "m.avg_rating DESC")

        params.append(limit)
        idx = len(params)
        models = await conn.fetch(
            f"""SELECT m.*, p.name as provider_name, p.slug as provider_slug
                FROM ai_models m
                JOIN ai_providers p ON m.provider_id = p.id
                {condition}
                ORDER BY {order_by}
                LIMIT ${idx}""",
            *params
        )
        return {
            "leaderboard": [{"rank": i + 1, **dict(m)} for i, m in enumerate(models)],
            "metric": metric,
        }

@app.get("/api/v1/models/{model_id}")
async def get_model(model_id: str):
    """Get detailed model information"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        model = await conn.fetchrow(
            """SELECT m.*, p.name as provider_name, p.slug as provider_slug,
                      p.logo_url as provider_logo, p.website as provider_website
               FROM ai_models m
               JOIN ai_providers p ON m.provider_id = p.id
               WHERE m.id = $1""",
            model_id
        )
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")

        features = await conn.fetch(
            "SELECT * FROM model_features WHERE model_id = $1", model_id
        )
        pricing = await conn.fetch(
            "SELECT * FROM model_pricing_tiers WHERE model_id = $1 ORDER BY effective_from DESC", model_id
        )
        reviews_summary = await conn.fetchrow(
            """SELECT COUNT(*) as count, AVG(rating) as avg_rating,
                      COUNT(*) FILTER (WHERE rating = 5) as five_star,
                      COUNT(*) FILTER (WHERE rating = 4) as four_star,
                      COUNT(*) FILTER (WHERE rating = 3) as three_star,
                      COUNT(*) FILTER (WHERE rating = 2) as two_star,
                      COUNT(*) FILTER (WHERE rating = 1) as one_star
               FROM model_reviews WHERE model_id = $1 AND status = 'published'""",
            model_id
        )
        # Token exchange rate
        exchange_rates = await conn.fetch(
            """SELECT * FROM token_exchange_rates
               WHERE model_id = $1 AND (effective_until IS NULL OR effective_until > NOW())
               ORDER BY effective_from DESC""",
            model_id
        )

        return {
            "model": dict(model),
            "features": [dict(f) for f in features],
            "pricing_tiers": [dict(p) for p in pricing],
            "reviews_summary": dict(reviews_summary) if reviews_summary else {},
            "token_exchange_rates": [dict(e) for e in exchange_rates],
        }

# ── Comparison ─────────────────────────────────────────────────────

@app.post("/api/v1/models/compare")
async def compare_models(request: ModelComparisonRequest):
    """Compare 2-5 models side by side with detailed matrix"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        models = []
        for mid in request.model_ids:
            model = await conn.fetchrow(
                """SELECT m.*, p.name as provider_name, p.slug as provider_slug
                   FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id
                   WHERE m.id = $1""",
                mid
            )
            if model:
                features = await conn.fetch(
                    "SELECT * FROM model_features WHERE model_id = $1", mid
                )
                models.append({**dict(model), "features": [dict(f) for f in features]})

        if len(models) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 valid models")

        # Build comparison matrix
        matrix = {
            "pricing": {
                m["name"]: {
                    "input_per_1m": float(m["input_price_per_million"] or 0),
                    "output_per_1m": float(m["output_price_per_million"] or 0),
                    "cost_for_1k_requests": round(
                        (float(m["input_price_per_million"] or 0) * 1000 / 1000000 +
                         float(m["output_price_per_million"] or 0) * 500 / 1000000) * 1000, 4
                    )
                } for m in models
            },
            "performance": {
                m["name"]: {
                    "context_window": m["context_window"],
                    "max_output_tokens": m["max_output_tokens"],
                    "avg_latency_ms": m["avg_latency_ms"],
                    "tokens_per_second": m["avg_tokens_per_second"],
                } for m in models
            },
            "capabilities": {
                m["name"]: m.get("capabilities", {}) for m in models
            },
            "benchmarks": {
                m["name"]: m.get("benchmarks", {}) for m in models
            },
            "general": {
                m["name"]: {
                    "provider": m["provider_name"],
                    "open_source": m["is_open_source"],
                    "parameters": m["parameters_count"],
                    "rating": float(m["avg_rating"] or 0),
                    "total_ratings": m["total_ratings"],
                } for m in models
            }
        }

        # Simple recommendation based on best overall score
        scores = {}
        for m in models:
            score = 0
            score += float(m["avg_rating"] or 0) * 20
            score += min(float(m["context_window"] or 0) / 2000, 50)
            if m["input_price_per_million"]:
                score += max(0, 30 - float(m["input_price_per_million"]))
            scores[m["name"]] = round(score, 2)

        best = max(scores, key=scores.get)
        recommendation = {
            "best_overall": best,
            "scores": scores,
            "cheapest": min(models, key=lambda x: float(x["input_price_per_million"] or 999))["name"],
            "fastest": min(models, key=lambda x: x["avg_latency_ms"] or 9999)["name"],
            "highest_rated": max(models, key=lambda x: float(x["avg_rating"] or 0))["name"],
        }

        return {
            "models": models,
            "comparison_matrix": matrix,
            "recommendation": recommendation,
        }

# ── Reviews ────────────────────────────────────────────────────────

@app.get("/api/v1/models/{model_id}/reviews")
async def get_reviews(
    model_id: str,
    page: int = 1,
    page_size: int = 10,
    sort_by: str = "created_at",
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        offset = (page - 1) * page_size
        reviews = await conn.fetch(
            f"""SELECT r.*, u.full_name, u.avatar_url
                FROM model_reviews r
                JOIN users u ON r.user_id = u.id
                WHERE r.model_id = $1 AND r.status = 'published'
                ORDER BY r.{sort_by} DESC
                LIMIT $2 OFFSET $3""",
            model_id, page_size, offset
        )
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM model_reviews WHERE model_id = $1 AND status = 'published'",
            model_id
        )
        return {"reviews": [dict(r) for r in reviews], "total": total}

@app.post("/api/v1/models/{model_id}/reviews")
async def create_review(model_id: str, review: ReviewCreate):
    """Submit a review for a model"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        review_id = str(uuid.uuid4())
        await conn.execute(
            """INSERT INTO model_reviews (id, user_id, model_id, rating, title, review_text, pros, cons)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
            review_id, "current-user-id", model_id, review.rating,
            review.title, review.review_text, review.pros, review.cons
        )
        # Update model avg rating
        await conn.execute(
            """UPDATE ai_models SET
                avg_rating = (SELECT AVG(rating) FROM model_reviews WHERE model_id = $1 AND status = 'published'),
                total_ratings = (SELECT COUNT(*) FROM model_reviews WHERE model_id = $1 AND status = 'published')
               WHERE id = $1""",
            model_id
        )
        return {"id": review_id, "message": "Review submitted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
