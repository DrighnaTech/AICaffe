"""
AICaffe Recommendation Engine - Intelligent model selection based on use case
"""
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
import os
import uuid

app = FastAPI(title="AICaffe Recommendation Engine", version="1.0.0")

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
    """Quick recommendation by just selecting a purpose"""
    purpose: str = Field(description="e.g., 'write blog post', 'generate image', 'transcribe audio', 'analyze code'")
    priority: Priority = Priority.BALANCED

class RecommendedModel(BaseModel):
    model_id: str
    model_name: str
    provider_name: str
    model_type: str
    match_score: float
    estimated_cost_act: Optional[int]
    reasoning: str
    strengths: List[str]
    limitations: List[str]

# ── Recommendation Logic ──────────────────────────────────────────

# Model type mapping for different tasks
TASK_TO_MODEL_TYPE = {
    "text": ["llm", "multimodal"],
    "image": ["image_generation", "multimodal"],
    "audio": ["audio_generation", "text_to_speech", "audio_transcription"],
    "video": ["video_generation", "multimodal"],
    "code": ["code_generation", "llm"],
    "embedding": ["embedding"],
    "search": ["search"],
    "translation": ["llm", "translation"],
}

# Keywords to detect use case intent
INTENT_KEYWORDS = {
    "write": {"output": "text", "types": ["llm"]},
    "blog": {"output": "text", "types": ["llm"]},
    "email": {"output": "text", "types": ["llm"]},
    "summarize": {"output": "text", "types": ["llm"]},
    "translate": {"output": "text", "types": ["llm", "translation"]},
    "code": {"output": "code", "types": ["code_generation", "llm"]},
    "debug": {"output": "code", "types": ["code_generation", "llm"]},
    "program": {"output": "code", "types": ["code_generation", "llm"]},
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
    "research": {"output": "text", "types": ["llm", "search"]},
    "analyze": {"output": "text", "types": ["llm", "multimodal"]},
    "chat": {"output": "text", "types": ["llm"]},
    "embed": {"output": "embedding", "types": ["embedding"]},
    "search": {"output": "text", "types": ["search"]},
}

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
    return {"status": "healthy", "service": "recommendation-engine"}

@app.get("/api/v1/recommendations/use-cases")
async def list_use_cases():
    """List all available use case categories and use cases"""
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
    async with pool.acquire() as conn:
        # Determine required model types from modalities
        required_types = set()
        for out in request.output_modalities:
            required_types.update(TASK_TO_MODEL_TYPE.get(out.value, ["llm"]))

        # Detect intent from description
        desc_lower = request.description.lower()
        for keyword, info in INTENT_KEYWORDS.items():
            if keyword in desc_lower:
                required_types.update(info["types"])

        type_list = list(required_types)
        placeholders = ", ".join([f"${i+1}" for i in range(len(type_list))])

        # Query models matching types
        query = f"""
            SELECT m.*, p.name as provider_name, p.slug as provider_slug,
                   COALESCE(s.overall_recommendation_score, 0) as use_case_score
            FROM ai_models m
            JOIN ai_providers p ON m.provider_id = p.id
            LEFT JOIN model_use_case_scores s ON s.model_id = m.id
            WHERE m.status = 'active' AND m.model_type IN ({placeholders})
        """
        params = type_list

        if request.min_context_window:
            query += f" AND m.context_window >= ${len(params)+1}"
            params.append(request.min_context_window)

        if request.prefer_open_source:
            query += " AND m.is_open_source = TRUE"

        query += " ORDER BY m.avg_rating DESC, m.total_api_calls DESC"
        query += f" LIMIT ${len(params)+1}"
        params.append(request.max_results * 3)

        models = await conn.fetch(query, *params)

        # Score and rank models
        recommendations = []
        for model in models:
            score = 0.0
            strengths = []
            limitations = []

            # Rating score (0-25)
            rating = float(model["avg_rating"] or 0)
            score += rating * 5
            if rating >= 4.5:
                strengths.append("Highly rated by users")

            # Price score (0-25)
            input_price = float(model["input_price_per_million"] or 0)
            if request.priority == Priority.COST:
                if input_price == 0:
                    score += 25
                    strengths.append("Free to use")
                elif input_price < 1:
                    score += 20
                    strengths.append("Very affordable pricing")
                elif input_price < 5:
                    score += 15
                elif input_price < 15:
                    score += 10
                else:
                    score += 5
                    limitations.append("Premium pricing")
            else:
                score += max(0, 15 - input_price)

            # Speed score (0-25)
            latency = model["avg_latency_ms"] or 1000
            if request.priority == Priority.SPEED:
                if latency < 200:
                    score += 25
                    strengths.append("Ultra-fast response times")
                elif latency < 500:
                    score += 20
                    strengths.append("Fast inference")
                elif latency < 1000:
                    score += 15
                else:
                    score += 5
                    limitations.append("Higher latency")
            else:
                score += max(0, 20 - latency / 100)

            # Context window bonus
            ctx = model["context_window"] or 0
            if ctx >= 128000:
                score += 10
                strengths.append(f"Large {ctx//1000}K context window")
            elif ctx >= 32000:
                score += 5

            # Quality priority boost
            if request.priority == Priority.QUALITY:
                benchmarks = model.get("benchmarks") or {}
                if isinstance(benchmarks, dict):
                    avg_bench = sum(float(v) for v in benchmarks.values() if isinstance(v, (int, float))) / max(len(benchmarks), 1)
                    score += min(avg_bench / 4, 25)
                    if avg_bench > 85:
                        strengths.append("Top benchmark scores")

            # Open source bonus
            if model["is_open_source"]:
                strengths.append("Open source - full transparency")
                if request.prefer_open_source:
                    score += 15

            # Use case specific score
            score += float(model.get("use_case_score") or 0) / 4

            # Featured boost
            if model["is_featured"]:
                score += 5

            # Estimate cost for typical usage
            est_cost = None
            if model["input_price_per_million"] and model["output_price_per_million"]:
                typical_cost = (
                    float(model["input_price_per_million"]) * 1000 / 1000000 +
                    float(model["output_price_per_million"]) * 500 / 1000000
                )
                est_cost = int(typical_cost * 1.20 * 20000) + 1

            if not limitations:
                limitations.append("Standard option in its category")

            reasoning = f"Recommended for {request.description[:100]}. "
            if request.priority == Priority.COST:
                reasoning += f"Optimized for cost efficiency at ${input_price}/M input tokens."
            elif request.priority == Priority.SPEED:
                reasoning += f"Offers {latency}ms average latency."
            elif request.priority == Priority.QUALITY:
                reasoning += f"Rated {rating}/5 with strong benchmark performance."
            else:
                reasoning += f"Good balance of quality ({rating}/5), speed ({latency}ms), and pricing."

            recommendations.append({
                "model_id": str(model["id"]),
                "model_name": model["name"],
                "provider_name": model["provider_name"],
                "model_type": model["model_type"],
                "match_score": round(min(score, 100), 1),
                "estimated_cost_act": est_cost,
                "reasoning": reasoning,
                "strengths": strengths[:4],
                "limitations": limitations[:3],
                "context_window": model["context_window"],
                "pricing": {
                    "input_per_million": float(model["input_price_per_million"] or 0),
                    "output_per_million": float(model["output_price_per_million"] or 0),
                },
            })

        # Sort by score, take top N
        recommendations.sort(key=lambda x: x["match_score"], reverse=True)
        recommendations = recommendations[:request.max_results]

        # Log recommendation
        log_id = str(uuid.uuid4())
        # In production, save to recommendations_log table

        return {
            "recommendations": recommendations,
            "query": {
                "description": request.description,
                "priority": request.priority,
                "input_modalities": [m.value for m in request.input_modalities],
                "output_modalities": [m.value for m in request.output_modalities],
            },
            "total_models_evaluated": len(models),
        }

@app.post("/api/v1/recommendations/quick")
async def quick_recommend(request: QuickRecommendRequest):
    """Quick recommendation by just describing what you want to do"""
    # Parse purpose into modalities
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
