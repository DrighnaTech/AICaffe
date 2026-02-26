"""
AICaffe AI Proxy Service - Unified API to call any AI model through a single interface
Handles routing, token consumption, response normalization, streaming, and provider fallback.
"""
from fastapi import FastAPI, HTTPException, Depends, Request, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, AsyncIterator
from datetime import datetime
import httpx
import json
import os
import uuid
import asyncio
import time

app = FastAPI(title="AICaffe AI Proxy Service", version="1.0.0")

TOKEN_SERVICE_URL = os.getenv("TOKEN_SERVICE_URL", "http://localhost:8003")

# ── Standardized Error Codes ────────────────────────────────────────

def ac_error(status: int, code: str, message: str, detail: dict = None) -> HTTPException:
    """Return an HTTPException with AiCaffe standardized error format."""
    body = {"error": {"code": code, "message": message}}
    if detail:
        body["error"]["detail"] = detail
    return HTTPException(status_code=status, detail=body)

# ── Provider Fallback Order ──────────────────────────────────────────
# Ordered by: free/available API keys first, then premium providers.
# When the requested provider fails, we try these in order.
FALLBACK_PROVIDER_ORDER = [
    "groq",        # Free, very fast (Llama 3)
    "google",      # Free tier (Gemini Flash)
    "deepseek",    # Very cheap (DeepSeek Chat)
    "cerebras",    # Free, ultra-fast
    "openrouter",  # Aggregator fallback
    "mistral",     # Free tier available
    "openai",      # Paid, but reliable
    "anthropic",   # Paid, but reliable
]

# ── Provider Adapters ──────────────────────────────────────────────

class ProviderAdapter:
    """Base adapter for AI providers"""

    @staticmethod
    async def call(model_identifier: str, api_key: str, api_base: str, request_data: dict) -> dict:
        raise NotImplementedError

    @staticmethod
    async def stream_call(
        model_identifier: str, api_key: str, api_base: str, request_data: dict
    ) -> AsyncIterator[str]:
        """Yield SSE-formatted strings. Default: fall back to non-streaming."""
        result = await ProviderAdapter.call(model_identifier, api_key, api_base, request_data)
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        usage = result.get("usage", {})
        chunk = {
            "choices": [{"delta": {"content": content}, "finish_reason": "stop"}],
            "usage": usage,
        }
        yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"


class OpenAIAdapter(ProviderAdapter):
    @staticmethod
    async def call(model_identifier: str, api_key: str, api_base: str, request_data: dict) -> dict:
        async with httpx.AsyncClient(timeout=120.0) as client:
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {
                "model": model_identifier,
                "messages": request_data.get("messages", []),
                "temperature": request_data.get("temperature", 0.7),
                "max_tokens": request_data.get("max_tokens", 4096),
                "stream": False,
            }
            if request_data.get("tools"):
                payload["tools"] = request_data["tools"]
            response = await client.post(f"{api_base}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def stream_call(
        model_identifier: str, api_key: str, api_base: str, request_data: dict
    ) -> AsyncIterator[str]:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model_identifier,
            "messages": request_data.get("messages", []),
            "temperature": request_data.get("temperature", 0.7),
            "max_tokens": request_data.get("max_tokens", 4096),
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", f"{api_base}/chat/completions", headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        yield line + "\n\n"


class AnthropicAdapter(ProviderAdapter):
    @staticmethod
    async def call(model_identifier: str, api_key: str, api_base: str, request_data: dict) -> dict:
        async with httpx.AsyncClient(timeout=120.0) as client:
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            }
            messages = request_data.get("messages", [])
            system_msg = next((m["content"] for m in messages if m["role"] == "system"), None)
            conv_messages = [m for m in messages if m["role"] != "system"]

            payload = {
                "model": model_identifier,
                "messages": conv_messages,
                "max_tokens": request_data.get("max_tokens", 4096),
            }
            if system_msg:
                payload["system"] = system_msg

            response = await client.post(f"{api_base}/messages", headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

            return {
                "id": data.get("id"),
                "model": data.get("model"),
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": data["content"][0]["text"] if data.get("content") else "",
                    },
                    "finish_reason": data.get("stop_reason", "stop"),
                }],
                "usage": {
                    "prompt_tokens": data.get("usage", {}).get("input_tokens", 0),
                    "completion_tokens": data.get("usage", {}).get("output_tokens", 0),
                    "total_tokens": (
                        data.get("usage", {}).get("input_tokens", 0) +
                        data.get("usage", {}).get("output_tokens", 0)
                    ),
                }
            }

    @staticmethod
    async def stream_call(
        model_identifier: str, api_key: str, api_base: str, request_data: dict
    ) -> AsyncIterator[str]:
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        messages = request_data.get("messages", [])
        system_msg = next((m["content"] for m in messages if m["role"] == "system"), None)
        conv_messages = [m for m in messages if m["role"] != "system"]
        payload = {
            "model": model_identifier,
            "messages": conv_messages,
            "max_tokens": request_data.get("max_tokens", 4096),
            "stream": True,
        }
        if system_msg:
            payload["system"] = system_msg

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", f"{api_base}/messages", headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        raw = line[6:]
                        try:
                            event = json.loads(raw)
                            if event.get("type") == "content_block_delta":
                                chunk = {
                                    "choices": [{
                                        "delta": {"content": event["delta"].get("text", "")},
                                        "finish_reason": None,
                                    }]
                                }
                                yield f"data: {json.dumps(chunk)}\n\n"
                            elif event.get("type") == "message_stop":
                                yield "data: [DONE]\n\n"
                        except json.JSONDecodeError:
                            pass


class GoogleAdapter(ProviderAdapter):
    @staticmethod
    async def call(model_identifier: str, api_key: str, api_base: str, request_data: dict) -> dict:
        async with httpx.AsyncClient(timeout=120.0) as client:
            url = f"{api_base}/models/{model_identifier}:generateContent?key={api_key}"
            messages = request_data.get("messages", [])
            contents = []
            for msg in messages:
                if msg["role"] == "system":
                    continue
                role = "user" if msg["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})

            payload = {"contents": contents}
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            usage = data.get("usageMetadata", {})

            return {
                "id": str(uuid.uuid4()),
                "model": model_identifier,
                "choices": [{"message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
                "usage": {
                    "prompt_tokens": usage.get("promptTokenCount", 0),
                    "completion_tokens": usage.get("candidatesTokenCount", 0),
                    "total_tokens": usage.get("totalTokenCount", 0),
                }
            }

    @staticmethod
    async def stream_call(
        model_identifier: str, api_key: str, api_base: str, request_data: dict
    ) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120.0) as client:
            url = f"{api_base}/models/{model_identifier}:streamGenerateContent?key={api_key}&alt=sse"
            messages = request_data.get("messages", [])
            contents = [
                {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
                for m in messages if m["role"] != "system"
            ]
            async with client.stream("POST", url, json={"contents": contents}) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            event = json.loads(line[6:])
                            text = (event.get("candidates", [{}])[0]
                                    .get("content", {}).get("parts", [{}])[0].get("text", ""))
                            if text:
                                chunk = {"choices": [{"delta": {"content": text}, "finish_reason": None}]}
                                yield f"data: {json.dumps(chunk)}\n\n"
                        except json.JSONDecodeError:
                            pass
        yield "data: [DONE]\n\n"


class GenericOpenAIAdapter(ProviderAdapter):
    """For providers that use OpenAI-compatible API (Groq, Together, DeepSeek, Mistral, etc.)"""
    @staticmethod
    async def call(model_identifier: str, api_key: str, api_base: str, request_data: dict) -> dict:
        async with httpx.AsyncClient(timeout=120.0) as client:
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {
                "model": model_identifier,
                "messages": request_data.get("messages", []),
                "temperature": request_data.get("temperature", 0.7),
                "max_tokens": request_data.get("max_tokens", 4096),
            }
            response = await client.post(f"{api_base}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def stream_call(
        model_identifier: str, api_key: str, api_base: str, request_data: dict
    ) -> AsyncIterator[str]:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model_identifier,
            "messages": request_data.get("messages", []),
            "temperature": request_data.get("temperature", 0.7),
            "max_tokens": request_data.get("max_tokens", 4096),
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", f"{api_base}/chat/completions", headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        yield line + "\n\n"
                    elif line.strip() == "[DONE]":
                        yield "data: [DONE]\n\n"


class OpenRouterAdapter(ProviderAdapter):
    """OpenRouter — unified gateway to 100+ models via OpenAI-compatible API"""
    @staticmethod
    async def call(model_identifier: str, api_key: str, api_base: str, request_data: dict) -> dict:
        async with httpx.AsyncClient(timeout=120.0) as client:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://aicaffe.com",
                "X-Title": "AICaffe",
            }
            payload = {
                "model": model_identifier,
                "messages": request_data.get("messages", []),
                "temperature": request_data.get("temperature", 0.7),
                "max_tokens": request_data.get("max_tokens", 4096),
            }
            response = await client.post(f"{api_base}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def stream_call(
        model_identifier: str, api_key: str, api_base: str, request_data: dict
    ) -> AsyncIterator[str]:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://aicaffe.com",
            "X-Title": "AICaffe",
        }
        payload = {
            "model": model_identifier,
            "messages": request_data.get("messages", []),
            "temperature": request_data.get("temperature", 0.7),
            "max_tokens": request_data.get("max_tokens", 4096),
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", f"{api_base}/chat/completions", headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        yield line + "\n\n"


class CerebrasAdapter(ProviderAdapter):
    """Cerebras — ultra-fast inference via OpenAI-compatible API"""
    @staticmethod
    async def call(model_identifier: str, api_key: str, api_base: str, request_data: dict) -> dict:
        async with httpx.AsyncClient(timeout=120.0) as client:
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {
                "model": model_identifier,
                "messages": request_data.get("messages", []),
                "temperature": request_data.get("temperature", 0.7),
                "max_tokens": request_data.get("max_tokens", 4096),
            }
            response = await client.post(f"{api_base}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def stream_call(
        model_identifier: str, api_key: str, api_base: str, request_data: dict
    ) -> AsyncIterator[str]:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model_identifier,
            "messages": request_data.get("messages", []),
            "temperature": request_data.get("temperature", 0.7),
            "max_tokens": request_data.get("max_tokens", 4096),
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", f"{api_base}/chat/completions", headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        yield line + "\n\n"


# Provider adapter registry
ADAPTERS = {
    "openai": OpenAIAdapter,
    "anthropic": AnthropicAdapter,
    "google": GoogleAdapter,
    "mistral": GenericOpenAIAdapter,
    "groq": GenericOpenAIAdapter,
    "together": GenericOpenAIAdapter,
    "deepseek": GenericOpenAIAdapter,
    "xai": GenericOpenAIAdapter,
    "perplexity": GenericOpenAIAdapter,
    "cohere": GenericOpenAIAdapter,
    "openrouter": OpenRouterAdapter,
    "cerebras": CerebrasAdapter,
}

# ── Schemas ────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str = Field(description="'system', 'user', or 'assistant'")
    content: str

class ChatRequest(BaseModel):
    model_id: str
    messages: List[ChatMessage]
    temperature: float = 0.7
    max_tokens: int = 4096
    stream: bool = False
    tools: Optional[List[dict]] = None
    conversation_id: Optional[str] = None

class ConversationCreate(BaseModel):
    title: Optional[str] = "New Conversation"
    model_id: str
    use_case_slug: Optional[str] = None
    system_prompt: Optional[str] = None

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

# ── Auth Helpers ───────────────────────────────────────────────────

def get_user_id(
    user_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
) -> str:
    resolved_user_id = user_id or x_user_id
    if not resolved_user_id:
        raise ac_error(401, "AC_401", "Authentication required. Please login.")
    return resolved_user_id

def get_optional_user_id(
    user_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
) -> Optional[str]:
    return user_id or x_user_id

# ── Fallback Helpers ───────────────────────────────────────────────

async def get_fallback_model(conn, exclude_provider_slug: str):
    """Find the best fallback model from a different provider with a configured API key."""
    for provider_slug in FALLBACK_PROVIDER_ORDER:
        if provider_slug == exclude_provider_slug:
            continue
        env_key = f"{provider_slug.upper().replace('-', '_')}_API_KEY"
        if not os.getenv(env_key):
            continue
        model = await conn.fetchrow(
            """SELECT m.*, p.slug as provider_slug, p.api_base_url
               FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id
               WHERE p.slug = $1 AND m.status = 'active' AND m.model_type = 'llm'
               ORDER BY m.total_api_calls DESC LIMIT 1""",
            provider_slug
        )
        if model:
            return model
    return None

# ── Routes ─────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ai-proxy"}

# ── Chat Completion (Unified API) ──────────────────────────────────

@app.post("/api/v1/chat/completions")
async def chat_completion(
    request: ChatRequest,
    user_id: str = Depends(get_user_id)
):
    """
    Universal chat completion endpoint.
    Routes to any AI provider through a single API.
    Handles token billing and automatic provider fallback (up to 3 attempts).
    """
    start_time = time.time()
    pool = await get_pool()

    async with pool.acquire() as conn:
        model = await conn.fetchrow(
            """SELECT m.*, p.slug as provider_slug, p.api_base_url
               FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id
               WHERE m.id = $1 AND m.status = 'active'""",
            request.model_id
        )
        if not model:
            raise ac_error(404, "AC_404", "Model not found or inactive", {"model_id": request.model_id})

        credential = await conn.fetchrow(
            """SELECT encrypted_api_key FROM provider_credentials
               WHERE (user_id = $1 OR organization_id IS NOT NULL)
               AND provider_id = $2 AND is_active = TRUE
               ORDER BY user_id DESC NULLS LAST LIMIT 1""",
            user_id, model["provider_id"]
        )
        api_key = credential["encrypted_api_key"] if credential else os.getenv(
            f"{model['provider_slug'].upper().replace('-', '_')}_API_KEY", ""
        )
        if not api_key:
            raise ac_error(
                400, "AC_400",
                f"No API key configured for {model['provider_slug']}. Add your key in Settings.",
                {"provider": model["provider_slug"]}
            )

        request_data = {
            "messages": [{"role": m.role, "content": m.content} for m in request.messages],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": False,
        }
        if request.tools:
            request_data["tools"] = request.tools

        api_call_id = str(uuid.uuid4())
        result = None
        used_model = model
        current_api_key = api_key
        fallback_used = False
        last_error = None

        # ── Provider call with cross-provider fallback ─────────────
        for attempt in range(3):
            current_adapter = ADAPTERS.get(used_model["provider_slug"], GenericOpenAIAdapter)
            try:
                result = await current_adapter.call(
                    model_identifier=used_model["model_identifier"],
                    api_key=current_api_key,
                    api_base=used_model["api_base_url"],
                    request_data=request_data,
                )
                break  # success

            except (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException, Exception) as e:
                last_error = e
                error_status = e.response.status_code if isinstance(e, httpx.HTTPStatusError) else 502
                print(f"[ai-proxy] Provider {used_model['provider_slug']} failed (attempt {attempt + 1}): {e}")

                # Don't fallback on non-retryable client errors
                if isinstance(e, httpx.HTTPStatusError) and 400 <= error_status < 500 and error_status != 429:
                    await conn.execute(
                        """INSERT INTO api_calls (id, user_id, model_id, request_type, status_code, error_message, status)
                           VALUES ($1, $2, $3, 'chat', $4, $5, 'failed')""",
                        api_call_id, user_id, request.model_id, error_status, str(e)[:500]
                    )
                    raise ac_error(error_status, "AC_422", f"Provider rejected request: {str(e)[:200]}")

                fallback = await get_fallback_model(conn, used_model["provider_slug"])
                if not fallback:
                    break
                used_model = fallback
                current_api_key = os.getenv(
                    f"{used_model['provider_slug'].upper().replace('-', '_')}_API_KEY", ""
                )
                fallback_used = True

        if result is None:
            await conn.execute(
                """INSERT INTO api_calls (id, user_id, model_id, request_type, status_code, error_message, status)
                   VALUES ($1, $2, $3, 'chat', 503, $4, 'failed')""",
                api_call_id, user_id, request.model_id, str(last_error)[:500]
            )
            raise ac_error(503, "AC_503", "All AI providers are currently unavailable. Please try again shortly.")

        latency_ms = int((time.time() - start_time) * 1000)
        usage = result.get("usage", {})
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)

        # Consume tokens
        cost_info = {}
        try:
            async with httpx.AsyncClient() as client:
                token_resp = await client.post(
                    f"{TOKEN_SERVICE_URL}/api/v1/tokens/consume",
                    params={
                        "user_id": user_id,
                        "model_id": str(used_model["id"]),
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "api_call_id": api_call_id,
                    }
                )
                if token_resp.status_code == 200:
                    cost_info = token_resp.json()
                elif token_resp.status_code == 402:
                    raise ac_error(402, "AC_402",
                                   token_resp.json().get("detail", "Insufficient ACT tokens. Please purchase more."))
        except HTTPException:
            raise
        except Exception as e:
            print(f"[ai-proxy] Token service error: {e}")

        # Record API call
        await conn.execute(
            """INSERT INTO api_calls
               (id, user_id, model_id, request_type, request_tokens, response_tokens, total_tokens,
                response_time_ms, status_code, aicaffe_tokens_charged, provider_cost_usd, margin_usd, status)
               VALUES ($1, $2, $3, 'chat', $4, $5, $6, $7, 200, $8, $9, $10, 'completed')""",
            api_call_id, user_id, str(used_model["id"]), input_tokens, output_tokens,
            input_tokens + output_tokens, latency_ms,
            cost_info.get("tokens_charged", 0),
            cost_info.get("provider_cost_usd", 0),
            cost_info.get("margin_usd", 0),
        )

        assistant_msg = result.get("choices", [{}])[0].get("message", {})
        if request.conversation_id:
            await conn.execute(
                """INSERT INTO messages (id, conversation_id, role, content, model_id, input_tokens)
                   VALUES ($1, $2, 'user', $3, $4, $5)""",
                str(uuid.uuid4()), request.conversation_id,
                request.messages[-1].content, str(used_model["id"]), input_tokens
            )
            await conn.execute(
                """INSERT INTO messages (id, conversation_id, role, content, model_id, output_tokens, aicaffe_tokens_charged, latency_ms)
                   VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7)""",
                str(uuid.uuid4()), request.conversation_id,
                assistant_msg.get("content", ""), str(used_model["id"]), output_tokens,
                cost_info.get("tokens_charged", 0), latency_ms
            )
            await conn.execute(
                """UPDATE conversations SET total_messages = total_messages + 2,
                   total_tokens_used = total_tokens_used + $1, last_message_at = NOW()
                   WHERE id = $2""",
                cost_info.get("tokens_charged", 0), request.conversation_id
            )

        await conn.execute(
            "UPDATE ai_models SET total_api_calls = total_api_calls + 1 WHERE id = $1",
            str(used_model["id"])
        )

        response_body = {
            "id": api_call_id,
            "model": used_model["name"],
            "provider": used_model["provider_slug"],
            "message": assistant_msg,
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
            },
            "aicaffe_tokens_charged": cost_info.get("tokens_charged", 0),
            "cost": {
                "aicaffe_tokens": cost_info.get("tokens_charged", 0),
                "provider_cost_usd": cost_info.get("provider_cost_usd", 0),
                "margin_usd": cost_info.get("margin_usd", 0),
                "remaining_balance": cost_info.get("new_balance", 0),
            },
            "latency_ms": latency_ms,
            "conversation_id": request.conversation_id,
        }
        if fallback_used:
            response_body["fallback_used"] = True
            response_body["requested_model_id"] = request.model_id

        return response_body

# ── SSE Streaming Chat ─────────────────────────────────────────────

@app.post("/api/v1/chat/stream")
async def chat_stream(
    request: ChatRequest,
    user_id: str = Depends(get_user_id)
):
    """
    Streaming chat completion using Server-Sent Events (SSE).
    Yields tokens as they arrive from the provider.
    Compatible with the OpenAI streaming format (data: {...}\\n\\n).
    """
    pool = await get_pool()

    async with pool.acquire() as conn:
        model = await conn.fetchrow(
            """SELECT m.*, p.slug as provider_slug, p.api_base_url
               FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id
               WHERE m.id = $1 AND m.status = 'active'""",
            request.model_id
        )
        if not model:
            raise ac_error(404, "AC_404", "Model not found or inactive")

        credential = await conn.fetchrow(
            """SELECT encrypted_api_key FROM provider_credentials
               WHERE (user_id = $1 OR organization_id IS NOT NULL)
               AND provider_id = $2 AND is_active = TRUE
               ORDER BY user_id DESC NULLS LAST LIMIT 1""",
            user_id, model["provider_id"]
        )
        api_key = credential["encrypted_api_key"] if credential else os.getenv(
            f"{model['provider_slug'].upper().replace('-', '_')}_API_KEY", ""
        )
        if not api_key:
            raise ac_error(400, "AC_400", f"No API key configured for {model['provider_slug']}.")

    adapter_class = ADAPTERS.get(model["provider_slug"], GenericOpenAIAdapter)
    request_data = {
        "messages": [{"role": m.role, "content": m.content} for m in request.messages],
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
    }

    async def event_generator():
        try:
            async for chunk in adapter_class.stream_call(
                model_identifier=model["model_identifier"],
                api_key=api_key,
                api_base=model["api_base_url"],
                request_data=request_data,
            ):
                yield chunk
        except Exception as e:
            error_chunk = {"error": {"code": "AC_503", "message": f"Stream error: {str(e)[:200]}"}}
            yield f"data: {json.dumps(error_chunk)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )

# ── Conversation Management ───────────────────────────────────────

@app.post("/api/v1/assistant/conversations")
async def create_conversation(
    data: ConversationCreate,
    user_id: str = Depends(get_user_id)
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        conv_id = str(uuid.uuid4())
        await conn.execute(
            """INSERT INTO conversations (id, user_id, title, model_id, use_case_id, system_prompt)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            conv_id, user_id, data.title, data.model_id, None, data.system_prompt
        )
        return {"id": conv_id, "title": data.title}

@app.get("/api/v1/assistant/conversations")
async def list_conversations(
    user_id: str = Depends(get_user_id),
    page: int = 1,
    page_size: int = 20
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        offset = (page - 1) * page_size
        convs = await conn.fetch(
            """SELECT c.*, m.name as model_name, p.name as provider_name
               FROM conversations c
               LEFT JOIN ai_models m ON c.model_id = m.id
               LEFT JOIN ai_providers p ON m.provider_id = p.id
               WHERE c.user_id = $1 AND c.is_archived = FALSE
               ORDER BY c.last_message_at DESC NULLS LAST
               LIMIT $2 OFFSET $3""",
            user_id, page_size, offset
        )
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM conversations WHERE user_id = $1 AND is_archived = FALSE",
            user_id
        )
        return {
            "conversations": [dict(c) for c in convs],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

@app.get("/api/v1/assistant/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user_id: str = Depends(get_user_id)
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        conv = await conn.fetchrow(
            "SELECT * FROM conversations WHERE id = $1 AND user_id = $2",
            conversation_id, user_id
        )
        if not conv:
            raise ac_error(404, "AC_404", "Conversation not found")
        messages = await conn.fetch(
            "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at",
            conversation_id
        )
        return {"conversation": dict(conv), "messages": [dict(m) for m in messages]}

@app.delete("/api/v1/assistant/conversations/{conversation_id}")
async def archive_conversation(
    conversation_id: str,
    user_id: str = Depends(get_user_id)
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE conversations SET is_archived = TRUE WHERE id = $1 AND user_id = $2",
            conversation_id, user_id
        )
        return {"message": "Conversation archived"}

@app.put("/api/v1/assistant/conversations/{conversation_id}/model")
async def switch_model(
    conversation_id: str,
    model_id: str,
    user_id: str = Depends(get_user_id)
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        conv = await conn.fetchrow(
            "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
            conversation_id, user_id
        )
        if not conv:
            raise ac_error(404, "AC_404", "Conversation not found")
        model = await conn.fetchrow(
            "SELECT id, name FROM ai_models WHERE id = $1 AND status = 'active'",
            model_id
        )
        if not model:
            raise ac_error(404, "AC_404", "Model not found or inactive")
        await conn.execute(
            "UPDATE conversations SET model_id = $1 WHERE id = $2",
            model_id, conversation_id
        )
        return {"message": f"Model switched to {model['name']}"}

# ── Image Generation ───────────────────────────────────────────────

@app.post("/api/v1/ai/images/generate")
async def generate_image(
    request: dict,
    user_id: str = Depends(get_user_id)
):
    model_id = request.get("model_id")
    prompt = request.get("prompt")
    size = request.get("size", "1024x1024")
    quality = request.get("quality", "standard")
    n = request.get("n", 1)

    if not model_id or not prompt:
        raise ac_error(422, "AC_422", "model_id and prompt are required")

    pool = await get_pool()
    async with pool.acquire() as conn:
        model = await conn.fetchrow(
            """SELECT m.*, p.slug as provider_slug, p.api_base_url
               FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id
               WHERE m.id = $1 AND m.status = 'active'""",
            model_id
        )
        if not model:
            raise ac_error(404, "AC_404", "Model not found")

        api_key = os.getenv(f"{model['provider_slug'].upper().replace('-', '_')}_API_KEY", "")
        if not api_key:
            raise ac_error(400, "AC_400", f"No API key for {model['provider_slug']}")

        if model["provider_slug"] == "openai":
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/images/generations",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": model["model_identifier"], "prompt": prompt,
                          "size": size, "quality": quality, "n": n}
                )
                response.raise_for_status()
                result = response.json()
                return {"images": result.get("data", []), "model": model["name"], "prompt": prompt}

        raise ac_error(400, "AC_400", "Image generation not supported for this provider")

# ── Audio Generation ───────────────────────────────────────────────

@app.post("/api/v1/ai/audio/generate")
async def generate_audio(
    request: dict,
    user_id: str = Depends(get_user_id)
):
    model_id = request.get("model_id")
    input_text = request.get("input")
    voice = request.get("voice", "alloy")
    speed = request.get("speed", 1.0)

    if not model_id or not input_text:
        raise ac_error(422, "AC_422", "model_id and input are required")

    pool = await get_pool()
    async with pool.acquire() as conn:
        model = await conn.fetchrow(
            """SELECT m.*, p.slug as provider_slug, p.api_base_url
               FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id
               WHERE m.id = $1 AND m.status = 'active'""",
            model_id
        )
        if not model:
            raise ac_error(404, "AC_404", "Model not found")

        api_key = os.getenv(f"{model['provider_slug'].upper().replace('-', '_')}_API_KEY", "")
        if not api_key:
            raise ac_error(400, "AC_400", f"No API key for {model['provider_slug']}")

        if model["provider_slug"] == "openai":
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/audio/speech",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": model["model_identifier"], "input": input_text,
                          "voice": voice, "speed": speed}
                )
                response.raise_for_status()
                audio_id = str(uuid.uuid4())
                return {"audio_id": audio_id, "model": model["name"], "text": input_text[:100]}

        raise ac_error(400, "AC_400", "Audio generation not supported for this provider")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
