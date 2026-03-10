"""
AICaffe Recommendation Engine - Intelligent model selection based on use case & query analysis
"""
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
import os
import uuid
import re

app = FastAPI(title="AICaffe Recommendation Engine", version="2.0.0")

# ── Schemas ────────────────────────────────────────────────────────

class InputModality(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    CODE = "code"
    DOCUMENT = "document"

class OutputModality(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    CODE = "code"
    EMBEDDING = "embedding"

class Priority(str, Enum):
    SPEED = "speed"
    QUALITY = "quality"
    COST = "cost"
    BALANCED = "balanced"

class RecommendationRequest(BaseModel):
    description: str = Field(description="Describe what you want to accomplish")
    input_modalities: List[InputModality] = [InputModality.TEXT]
    output_modalities: List[OutputModality] = [OutputModality.TEXT]
    use_case_slug: Optional[str] = None
    priority: Priority = Priority.BALANCED
    budget_tokens: Optional[int] = None
    min_context_window: Optional[int] = None
    prefer_open_source: bool = False
    max_results: int = 5

class QuickRecommendRequest(BaseModel):
    purpose: str = Field(description="e.g., 'write blog post', 'generate image', 'analyze code'")
    priority: Priority = Priority.BALANCED

class RecommendedModel(BaseModel):
    model_id: str
    model_name: str
    provider_name: str
    model_type: str
    match_score: float  # 0.0 to 1.0
    estimated_cost_act: Optional[int]
    reasoning: str
    strengths: List[str]
    limitations: List[str]

# ── Available Providers (checked from env) ───────────────────────

PROVIDER_ENV_MAP = {
    "google": "GOOGLE_API_KEY",
    "groq": "GROQ_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "cerebras": "CEREBRAS_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "cohere": "COHERE_API_KEY",
    "xai": "XAI_API_KEY",
}

# Provider health cache: tested on startup, refreshed periodically
_provider_health: Dict[str, bool] = {}
_health_checked = False

PROVIDER_TEST_CONFIG = {
    "groq": {"url": "https://api.groq.com/openai/v1/chat/completions", "model": "llama-3.3-70b-versatile", "type": "openai"},
    "google": {"url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", "type": "google"},
    "deepseek": {"url": "https://api.deepseek.com/v1/chat/completions", "model": "deepseek-chat", "type": "openai"},
    "mistral": {"url": "https://api.mistral.ai/v1/chat/completions", "model": "mistral-small-2409", "type": "openai"},
    "cerebras": {"url": "https://api.cerebras.ai/v1/chat/completions", "model": "llama3.1-8b", "type": "openai"},
    "openrouter": {"url": "https://openrouter.ai/api/v1/chat/completions", "model": "meta-llama/llama-3.1-405b-instruct", "type": "openai"},
}

async def _test_provider(slug: str, api_key: str) -> bool:
    """Test if a provider actually responds to requests"""
    import httpx
    config = PROVIDER_TEST_CONFIG.get(slug)
    if not config:
        return True  # Unknown providers assumed healthy

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if config["type"] == "google":
                url = f"{config['url']}?key={api_key}"
                resp = await client.post(url, json={
                    "contents": [{"role": "user", "parts": [{"text": "hi"}]}],
                    "generationConfig": {"maxOutputTokens": 5}
                })
            else:
                resp = await client.post(config["url"], headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }, json={
                    "model": config["model"],
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 5
                })
            return resp.status_code == 200
    except Exception:
        return False

async def check_provider_health():
    """Test all configured providers and cache which ones actually work"""
    global _provider_health, _health_checked
    for slug, env_var in PROVIDER_ENV_MAP.items():
        api_key = os.getenv(env_var)
        if not api_key:
            _provider_health[slug] = False
            continue
        if slug in PROVIDER_TEST_CONFIG:
            healthy = await _test_provider(slug, api_key)
            _provider_health[slug] = healthy
            status = "OK" if healthy else "FAIL"
            print(f"[health-check] {slug}: {status}")
        else:
            _provider_health[slug] = True  # Assume healthy if no test config
    _health_checked = True

def get_available_provider_slugs() -> List[str]:
    """Return provider slugs that have API keys AND are healthy"""
    available = []
    for slug, env_var in PROVIDER_ENV_MAP.items():
        if os.getenv(env_var):
            # If health checked, only include healthy providers
            if _health_checked and not _provider_health.get(slug, False):
                continue
            available.append(slug)
    return available

@app.on_event("startup")
async def startup():
    """Check provider health on startup"""
    await check_provider_health()

# ── Task Category Detection ──────────────────────────────────────

TASK_CATEGORIES = {
    "code": {
        "keywords": [
            "code", "program", "debug", "function", "api", "implement", "build app",
            "develop", "script", "algorithm", "sql", "database", "frontend", "backend",
            "css", "html", "javascript", "python", "react", "typescript", "bug", "fix code",
            "refactor", "class", "method", "compile", "deploy", "docker", "kubernetes",
        ],
        "model_affinities": {
            # model_identifier substring → bonus (0.0-0.3)
            "deepseek": 0.25,
            "codestral": 0.30,
            "llama-3.3": 0.15,
            "gemini": 0.10,
            "mistral": 0.12,
        },
        "provider_affinities": {
            "deepseek": 0.20,
            "mistral": 0.18,
            "groq": 0.12,
            "google": 0.10,
        },
    },
    "research": {
        "keywords": [
            "research", "analyze", "analysis", "study", "investigate", "explore",
            "explain", "understand", "how does", "what is", "why does", "why is",
            "history", "impact", "effect", "trend", "situation", "compare",
            "contrast", "overview", "in-depth", "comprehensive", "review",
            "politics", "economics", "science", "society", "culture",
        ],
        "model_affinities": {
            "gemini-1.5-pro": 0.25,
            "gemini-2.0": 0.20,
            "llama-3.3-70b": 0.18,
            "deepseek": 0.15,
        },
        "provider_affinities": {
            "google": 0.22,
            "groq": 0.15,
            "deepseek": 0.15,
            "openrouter": 0.10,
        },
    },
    "creative": {
        "keywords": [
            "write", "story", "poem", "creative", "blog", "article", "content",
            "essay", "narrative", "fiction", "novel", "copywriting", "email",
            "marketing", "slogan", "tagline", "advertisement", "letter",
        ],
        "model_affinities": {
            "llama-3.3-70b": 0.22,
            "gemini": 0.18,
            "mistral-large": 0.15,
        },
        "provider_affinities": {
            "groq": 0.18,
            "google": 0.16,
            "openrouter": 0.12,
        },
    },
    "math": {
        "keywords": [
            "math", "calculate", "equation", "formula", "proof", "theorem",
            "statistics", "probability", "algebra", "calculus", "geometry",
            "number", "solve", "compute",
        ],
        "model_affinities": {
            "deepseek-reasoner": 0.30,
            "deepseek": 0.22,
            "gemini-1.5-pro": 0.18,
            "llama-3.3-70b": 0.15,
        },
        "provider_affinities": {
            "deepseek": 0.25,
            "google": 0.15,
            "groq": 0.12,
        },
    },
    "conversation": {
        "keywords": [
            "chat", "talk", "help me", "assist", "question", "answer",
            "advice", "suggest", "recommend", "opinion", "hello", "hi",
        ],
        "model_affinities": {
            "llama-3.1-8b": 0.20,
            "gemini-2.0-flash": 0.22,
            "llama-3.3": 0.15,
        },
        "provider_affinities": {
            "groq": 0.22,
            "google": 0.18,
            "cerebras": 0.15,
        },
    },
    "translation": {
        "keywords": [
            "translate", "translation", "language", "convert text",
            "spanish", "french", "german", "chinese", "japanese", "hindi",
            "multilingual", "localize", "localization",
        ],
        "model_affinities": {
            "gemini": 0.25,
            "llama-3.3-70b": 0.15,
            "mistral": 0.18,
        },
        "provider_affinities": {
            "google": 0.25,
            "mistral": 0.15,
            "groq": 0.12,
        },
    },
    "summarization": {
        "keywords": [
            "summarize", "summary", "brief", "tldr", "key points",
            "condense", "shorten", "digest", "outline", "recap",
        ],
        "model_affinities": {
            "gemini-2.0-flash": 0.22,
            "llama-3.1-8b": 0.18,
            "llama-3.3": 0.15,
        },
        "provider_affinities": {
            "groq": 0.22,
            "google": 0.18,
            "cerebras": 0.15,
        },
    },
    "data_analysis": {
        "keywords": [
            "data", "dataset", "csv", "json", "table", "chart", "graph",
            "visualization", "dashboard", "report", "metrics", "kpi",
            "analytics", "pandas", "spreadsheet", "excel",
        ],
        "model_affinities": {
            "gemini-1.5-pro": 0.22,
            "deepseek": 0.18,
            "llama-3.3-70b": 0.15,
        },
        "provider_affinities": {
            "google": 0.20,
            "deepseek": 0.18,
            "groq": 0.12,
        },
    },
}

# Fallback for queries that don't match any category
DEFAULT_PROVIDER_AFFINITIES = {
    "groq": 0.15,
    "google": 0.15,
    "deepseek": 0.10,
    "openrouter": 0.08,
    "mistral": 0.08,
    "cerebras": 0.08,
}

# Model type mapping for different output modalities
TASK_TO_MODEL_TYPE = {
    "text": ["llm", "multimodal"],
    "image": ["image_generation", "multimodal"],
    "audio": ["audio_generation", "text_to_speech", "audio_transcription"],
    "video": ["video_generation", "multimodal"],
    "code": ["code_generation", "llm"],
    "embedding": ["embedding"],
    "search": ["search"],
}

# Keywords to detect output modality from purpose text
INTENT_KEYWORDS = {
    "image": {"output": "image", "types": ["image_generation"]},
    "photo": {"output": "image", "types": ["image_generation"]},
    "logo": {"output": "image", "types": ["image_generation"]},
    "draw": {"output": "image", "types": ["image_generation"]},
    "design": {"output": "image", "types": ["image_generation"]},
    "video": {"output": "video", "types": ["video_generation"]},
    "animate": {"output": "video", "types": ["video_generation"]},
    "transcribe": {"output": "text", "types": ["audio_transcription"]},
    "speech": {"output": "audio", "types": ["text_to_speech"]},
    "voice": {"output": "audio", "types": ["text_to_speech", "audio_generation"]},
    "music": {"output": "audio", "types": ["audio_generation"]},
    "song": {"output": "audio", "types": ["audio_generation"]},
    "embed": {"output": "embedding", "types": ["embedding"]},
}


def detect_task_category(query: str) -> tuple:
    """
    Analyze query text and return (category_name, confidence, category_config).
    Returns the best matching category based on keyword overlap.
    """
    query_lower = query.lower()
    best_category = None
    best_score = 0
    best_config = None

    for cat_name, cat_config in TASK_CATEGORIES.items():
        score = 0
        for keyword in cat_config["keywords"]:
            if keyword in query_lower:
                # Longer keywords get higher scores (more specific)
                score += len(keyword.split())
        if score > best_score:
            best_score = score
            best_category = cat_name
            best_config = cat_config

    # Require at least 1 keyword match
    if best_score > 0 and best_config:
        confidence = min(best_score / 5.0, 1.0)  # normalize
        return best_category, confidence, best_config

    return "general", 0.3, {
        "model_affinities": {},
        "provider_affinities": DEFAULT_PROVIDER_AFFINITIES,
    }


def compute_model_score(
    model: dict,
    priority: Priority,
    task_category: str,
    task_config: dict,
    task_confidence: float,
) -> tuple:
    """
    Score a model on a 0.0-1.0 scale based on quality, cost, speed, and task fit.
    Returns (score, strengths, limitations, reasoning).
    """
    strengths = []
    limitations = []

    # ── 1. Quality score (0-0.25) ─────────────────────────────────
    rating = float(model.get("avg_rating") or 3.0)
    quality = (rating / 5.0) * 0.25
    if rating >= 4.5:
        strengths.append("Highly rated by users")
    elif rating < 3.0:
        limitations.append("Below-average ratings")

    # ── 2. Price score (0-0.20) ───────────────────────────────────
    input_price = float(model.get("input_price_per_million") or 0)
    if input_price == 0:
        price_score = 0.20
        strengths.append("Free to use")
    elif input_price < 0.5:
        price_score = 0.18
        strengths.append("Very affordable")
    elif input_price < 2:
        price_score = 0.14
    elif input_price < 5:
        price_score = 0.10
    elif input_price < 15:
        price_score = 0.06
    else:
        price_score = 0.02
        limitations.append("Premium pricing")

    # ── 3. Speed score (0-0.15) ───────────────────────────────────
    latency = int(model.get("avg_latency_ms") or 1000)
    if latency < 200:
        speed_score = 0.15
        strengths.append("Ultra-fast response times")
    elif latency < 500:
        speed_score = 0.12
        strengths.append("Fast inference")
    elif latency < 1000:
        speed_score = 0.09
    elif latency < 2000:
        speed_score = 0.05
    else:
        speed_score = 0.02
        limitations.append("Higher latency")

    # ── 4. Context window score (0-0.10) ──────────────────────────
    ctx = int(model.get("context_window") or 0)
    if ctx >= 128000:
        ctx_score = 0.10
        strengths.append(f"Large {ctx // 1000}K context window")
    elif ctx >= 32000:
        ctx_score = 0.07
        strengths.append(f"{ctx // 1000}K context window")
    elif ctx >= 8000:
        ctx_score = 0.04
    else:
        ctx_score = 0.02

    # ── 5. Task affinity score (0-0.30) ── THE KEY DIFFERENTIATOR ─
    model_identifier = (model.get("model_identifier") or "").lower()
    provider_slug = (model.get("provider_slug") or "").lower()

    # Model-identifier affinity
    model_affinity = 0.0
    for pattern, bonus in task_config.get("model_affinities", {}).items():
        if pattern.lower() in model_identifier:
            model_affinity = max(model_affinity, bonus)

    # Provider affinity
    provider_affinity = task_config.get("provider_affinities", {}).get(provider_slug, 0.0)

    # Combine: take the best of model or provider affinity, scaled by confidence
    task_score = min(max(model_affinity, provider_affinity) * task_confidence, 0.30)

    if task_score >= 0.15:
        strengths.append(f"Well-suited for {task_category} tasks")

    # ── Priority adjustments ──────────────────────────────────────
    if priority == Priority.COST:
        price_score *= 1.6
        quality *= 0.7
    elif priority == Priority.SPEED:
        speed_score *= 1.6
        quality *= 0.7
    elif priority == Priority.QUALITY:
        quality *= 1.5
        price_score *= 0.7

    # ── Featured & open source bonuses ────────────────────────────
    bonus = 0.0
    if model.get("is_featured"):
        bonus += 0.03
    if model.get("is_open_source"):
        strengths.append("Open source")
        bonus += 0.02

    # ── Final score ───────────────────────────────────────────────
    raw_score = quality + price_score + speed_score + ctx_score + task_score + bonus
    final_score = round(min(max(raw_score, 0.0), 1.0), 3)

    # Generate reasoning
    reasoning = f"Recommended for {task_category} tasks. "
    if priority == Priority.COST:
        reasoning += f"Optimized for cost: ${input_price}/M input tokens. "
    elif priority == Priority.SPEED:
        reasoning += f"Fast response: ~{latency}ms latency. "
    elif priority == Priority.QUALITY:
        reasoning += f"High quality: rated {rating}/5. "
    else:
        reasoning += f"Good balance of quality ({rating}/5), speed ({latency}ms), and pricing. "

    if task_score >= 0.15:
        reasoning += f"Strong fit for {task_category} use cases."

    if not limitations:
        limitations.append("Standard option")

    return final_score, strengths[:4], limitations[:3], reasoning


# ── Database ───────────────────────────────────────────────────────

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

# ── Routes ─────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "recommendation-engine",
        "providers": {k: v for k, v in _provider_health.items()},
    }

@app.post("/api/v1/recommendations/refresh-providers")
async def refresh_providers():
    """Re-check which providers are healthy"""
    await check_provider_health()
    healthy = [k for k, v in _provider_health.items() if v]
    return {"healthy_providers": healthy, "all": dict(_provider_health)}

@app.get("/api/v1/recommendations/use-cases")
async def list_use_cases():
    """List all available use case categories"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        categories = await conn.fetch(
            "SELECT * FROM use_case_categories ORDER BY sort_order, name"
        )
        result = []
        for cat in categories:
            cases = await conn.fetch(
                "SELECT * FROM use_cases WHERE category_id = $1 ORDER BY name",
                cat["id"]
            )
            result.append({
                **dict(cat),
                "use_cases": [dict(c) for c in cases]
            })
        return {"categories": result}


@app.post("/api/v1/recommendations/recommend")
async def get_recommendation(request: RecommendationRequest):
    """Get AI model recommendations based on detailed requirements"""
    pool = await get_pool()

    # 1. Detect task category from the description
    task_category, task_confidence, task_config = detect_task_category(request.description)

    # 2. Get available providers (those with API keys)
    available_slugs = get_available_provider_slugs()
    if not available_slugs:
        raise HTTPException(status_code=503, detail="No AI providers configured")

    async with pool.acquire() as conn:
        # 3. Determine required model types from output modalities
        required_types = set()
        for out in request.output_modalities:
            required_types.update(TASK_TO_MODEL_TYPE.get(out.value, ["llm"]))

        # Also detect from description keywords
        desc_lower = request.description.lower()
        for keyword, info in INTENT_KEYWORDS.items():
            if keyword in desc_lower:
                required_types.update(info["types"])

        type_list = list(required_types)
        type_placeholders = ", ".join([f"${i+1}" for i in range(len(type_list))])

        # Provider filter
        slug_offset = len(type_list)
        slug_placeholders = ", ".join([f"${slug_offset + i + 1}" for i in range(len(available_slugs))])

        # 4. Query models from available providers only
        query = f"""
            SELECT m.*, p.name as provider_name, p.slug as provider_slug
            FROM ai_models m
            JOIN ai_providers p ON m.provider_id = p.id
            WHERE m.status = 'active'
              AND m.model_type IN ({type_placeholders})
              AND p.slug IN ({slug_placeholders})
        """
        params = type_list + available_slugs

        if request.min_context_window:
            query += f" AND m.context_window >= ${len(params)+1}"
            params.append(request.min_context_window)

        if request.prefer_open_source:
            query += " AND m.is_open_source = TRUE"

        query += " ORDER BY m.avg_rating DESC NULLS LAST"
        query += f" LIMIT ${len(params)+1}"
        params.append(request.max_results * 5)  # fetch more for scoring

        models = await conn.fetch(query, *params)

        # 5. Score and rank models
        recommendations = []
        for model in models:
            score, strengths, limitations, reasoning = compute_model_score(
                dict(model), request.priority, task_category, task_config, task_confidence
            )

            # Estimate cost
            est_cost = None
            inp = float(model["input_price_per_million"] or 0)
            out = float(model["output_price_per_million"] or 0)
            if inp or out:
                typical_cost_usd = (inp * 1000 / 1_000_000) + (out * 500 / 1_000_000)
                est_cost = int(typical_cost_usd * 1.20 * 20_000) + 1

            recommendations.append({
                "model_id": str(model["id"]),
                "model_name": model["name"],
                "model_identifier": model["model_identifier"],
                "provider_name": model["provider_name"],
                "provider_slug": model["provider_slug"],
                "model_type": model["model_type"],
                "match_score": score,  # 0.0 - 1.0
                "estimated_cost_act": est_cost,
                "reasoning": reasoning,
                "strengths": strengths,
                "limitations": limitations,
                "context_window": model["context_window"],
                "pricing": {
                    "input_per_million": float(model["input_price_per_million"] or 0),
                    "output_per_million": float(model["output_price_per_million"] or 0),
                },
            })

        # Sort by score descending
        recommendations.sort(key=lambda x: x["match_score"], reverse=True)
        recommendations = recommendations[:request.max_results]

        return {
            "recommendations": recommendations,
            "query": {
                "description": request.description,
                "priority": request.priority,
                "task_category": task_category,
                "task_confidence": round(task_confidence, 2),
                "input_modalities": [m.value for m in request.input_modalities],
                "output_modalities": [m.value for m in request.output_modalities],
            },
            "available_providers": available_slugs,
            "total_models_evaluated": len(models),
        }


@app.post("/api/v1/recommendations/quick")
async def quick_recommend(request: QuickRecommendRequest):
    """Quick recommendation by describing what you want to do"""
    purpose_lower = request.purpose.lower()
    input_mods = [InputModality.TEXT]
    output_mods = [OutputModality.TEXT]

    for keyword, info in INTENT_KEYWORDS.items():
        if keyword in purpose_lower:
            output_mod = info["output"]
            if output_mod == "image":
                output_mods = [OutputModality.IMAGE]
            elif output_mod == "audio":
                output_mods = [OutputModality.AUDIO]
            elif output_mod == "video":
                output_mods = [OutputModality.VIDEO]
            elif output_mod == "code":
                output_mods = [OutputModality.CODE]
            elif output_mod == "embedding":
                output_mods = [OutputModality.EMBEDDING]
            break

    full_request = RecommendationRequest(
        description=request.purpose,
        input_modalities=input_mods,
        output_modalities=output_mods,
        priority=request.priority,
        max_results=3,
    )
    return await get_recommendation(full_request)


@app.post("/api/v1/recommendations/feedback")
async def submit_feedback(
    recommendation_id: str,
    selected_model_id: str,
    rating: int = Query(ge=1, le=5),
    feedback_text: Optional[str] = None,
):
    """Submit feedback on a recommendation"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """UPDATE recommendations_log
               SET selected_model_id = $1, feedback_rating = $2, feedback_text = $3
               WHERE id = $4""",
            selected_model_id, rating, feedback_text, recommendation_id
        )
        return {"message": "Feedback recorded. Thank you!"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
