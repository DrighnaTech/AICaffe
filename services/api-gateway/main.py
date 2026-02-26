"""
AICaffe API Gateway - Central entry point for all microservices
Handles authentication, request routing, and user context injection
"""
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional
import jwt
from pydantic import BaseModel

# Service registry - defaults to localhost for local dev, use env vars for Docker/production
SERVICES = {
    "auth": os.getenv("AUTH_SERVICE_URL", "http://localhost:8001"),
    "models": os.getenv("MODEL_REGISTRY_URL", "http://localhost:8002"),
    "tokens": os.getenv("TOKEN_SERVICE_URL", "http://localhost:8003"),
    "recommendations": os.getenv("RECOMMENDATION_URL", "http://localhost:8004"),
    "news": os.getenv("NEWS_SERVICE_URL", "http://localhost:8005"),
    "ai-proxy": os.getenv("AI_PROXY_URL", "http://localhost:8006"),
    "billing": os.getenv("BILLING_SERVICE_URL", "http://localhost:8007"),
    "storage": os.getenv("STORAGE_SERVICE_URL", "http://localhost:8008"),
    "workspace": os.getenv("WORKSPACE_SERVICE_URL", "http://localhost:8009"),
    "orchestrator": os.getenv("ORCHESTRATOR_SERVICE_URL", "http://localhost:8010"),
    "ide": os.getenv("CLOUD_IDE_SERVICE_URL", "http://localhost:8011"),
}

JWT_SECRET = os.getenv("JWT_SECRET", "aicaffe-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)
    yield
    await app.state.http_client.aclose()

app = FastAPI(
    title="AICaffe API Gateway",
    description="Central gateway for the AICaffe AI Marketplace Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Middleware ──────────────────────────────────────────────────────

@app.middleware("http")
async def request_tracking(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(round(process_time * 1000, 2))
    return response

# ── Auth Helpers ──────────────────────────────────────────────────────

def decode_token(token: str) -> Optional[dict]:
    """Decode JWT token and return payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_user(request: Request) -> Optional[dict]:
    """Extract current user from Authorization header (optional)"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    return decode_token(token)

def ac_error(status: int, code: str, message: str) -> HTTPException:
    """Standardized AiCaffe error format: {"error": {"code": "AC_xxx", "message": "..."}}"""
    return HTTPException(status_code=status, detail={"error": {"code": code, "message": message}})

async def require_auth(request: Request) -> dict:
    """Require authentication - raises AC_401 if not authenticated"""
    user = await get_current_user(request)
    if not user:
        raise ac_error(401, "AC_401", "Authentication required. Please login.")
    return user

async def get_user_id_from_request(request: Request) -> Optional[str]:
    """Extract user_id from JWT token in Authorization header"""
    user = await get_current_user(request)
    if user:
        return user.get("sub")  # User ID is stored in 'sub' claim
    return None

# ── Proxy Helper ───────────────────────────────────────────────────

async def proxy_request(
    request: Request,
    service: str,
    path: str,
    inject_user_id: bool = False,
    require_authentication: bool = False
):
    """
    Proxy request to a backend service.

    Args:
        request: The incoming FastAPI request
        service: Service name from SERVICES registry
        path: Path to forward to
        inject_user_id: If True, inject user_id from JWT as query param
        require_authentication: If True, require valid JWT token
    """
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail=f"Service '{service}' not found")

    url = f"{SERVICES[service]}{path}"
    client: httpx.AsyncClient = request.app.state.http_client

    # Build headers
    headers = dict(request.headers)
    headers.pop("host", None)
    headers["X-Request-ID"] = getattr(request.state, "request_id", str(uuid.uuid4()))

    # Get user from JWT
    user = await get_current_user(request)
    user_id = user.get("sub") if user else None

    # Check authentication if required
    if require_authentication and not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Inject user context headers for downstream services
    if user:
        headers["X-User-ID"] = user_id
        headers["X-User-Email"] = user.get("email", "")
        headers["X-User-Role"] = user.get("role", "user")
        if user.get("org_id"):
            headers["X-Org-ID"] = user.get("org_id")

    # Build query params with user_id injection
    query_params = dict(request.query_params)
    if inject_user_id and user_id:
        query_params["user_id"] = user_id

    body = await request.body()

    try:
        response = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            content=body,
            params=query_params,
        )
        # Try to parse JSON, fall back to text if that fails
        content_type = response.headers.get("content-type", "")
        if content_type.startswith("application/json"):
            try:
                content = response.json()
            except Exception:
                content = {"data": response.text}
        else:
            content = {"data": response.text}
        return JSONResponse(status_code=response.status_code, content=content)
    except httpx.ConnectError:
        raise ac_error(503, "AC_503", f"Service '{service}' is unavailable. Please try again shortly.")
    except Exception as e:
        import traceback
        print(f"Gateway proxy error: {traceback.format_exc()}")
        raise ac_error(500, "AC_500", str(e))

# ── Health & Info ──────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": "AICaffe API Gateway",
        "version": "1.0.0",
        "description": "Unified AI Marketplace & Intelligence Platform",
        "endpoints": {
            "auth": "/api/v1/auth",
            "models": "/api/v1/models",
            "tokens": "/api/v1/tokens",
            "recommendations": "/api/v1/recommendations",
            "news": "/api/v1/news",
            "assistant": "/api/v1/assistant",
            "chat": "/api/v1/chat",
            "billing": "/api/v1/billing",
            "storage": "/api/v1/storage",
        }
    }

@app.get("/health")
async def health_check():
    services_status = {}
    client = app.state.http_client
    for name, url in SERVICES.items():
        try:
            resp = await client.get(f"{url}/health", timeout=5.0)
            services_status[name] = "healthy" if resp.status_code == 200 else "unhealthy"
        except Exception:
            services_status[name] = "unreachable"
    return {"status": "ok", "services": services_status}

# ── Auth Routes (Public) ────────────────────────────────────────────

@app.api_route("/api/v1/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def auth_proxy(request: Request, path: str):
    """Auth routes - mostly public (login, register) with some protected (me, change-password)"""
    return await proxy_request(request, "auth", f"/api/v1/auth/{path}")

# ── Model Registry Routes (Public Read, Protected Write) ───────────

@app.get("/api/v1/models")
async def models_list(request: Request):
    """List all models"""
    return await proxy_request(request, "models", "/api/v1/models")

@app.api_route("/api/v1/models/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def models_proxy(request: Request, path: str):
    # GET requests are public, POST/PUT/DELETE require auth
    require_auth = request.method in ["POST", "PUT", "DELETE"]
    return await proxy_request(
        request, "models", f"/api/v1/models/{path}",
        inject_user_id=require_auth,
        require_authentication=require_auth
    )

@app.get("/api/v1/providers")
async def providers_list(request: Request):
    """List all providers"""
    return await proxy_request(request, "models", "/api/v1/providers")

@app.api_route("/api/v1/providers/{path:path}", methods=["GET"])
async def providers_proxy(request: Request, path: str):
    return await proxy_request(request, "models", f"/api/v1/providers/{path}")

# ── Token Routes (Protected) ─────────────────────────────────────────

@app.get("/api/v1/tokens/wallet")
async def tokens_wallet(request: Request):
    """Get user's token wallet"""
    return await proxy_request(
        request, "tokens", "/api/v1/tokens/wallet",
        inject_user_id=True,
        require_authentication=True
    )

@app.get("/api/v1/tokens/packages")
async def tokens_packages(request: Request):
    """Get token packages (public)"""
    return await proxy_request(request, "tokens", "/api/v1/tokens/packages")

@app.get("/api/v1/tokens/transactions")
async def tokens_transactions(request: Request):
    """Get token transactions"""
    return await proxy_request(
        request, "tokens", "/api/v1/tokens/transactions",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/tokens/{path:path}", methods=["GET", "POST", "PUT"])
async def tokens_proxy(request: Request, path: str):
    """Token routes - all require authentication and user_id injection"""
    # Packages endpoint is public for viewing
    if path == "packages" and request.method == "GET":
        return await proxy_request(request, "tokens", f"/api/v1/tokens/{path}")

    # Calculate endpoint can be public
    if path == "calculate" or path == "compare-costs":
        return await proxy_request(request, "tokens", f"/api/v1/tokens/{path}")

    # All other token endpoints require auth
    return await proxy_request(
        request, "tokens", f"/api/v1/tokens/{path}",
        inject_user_id=True,
        require_authentication=True
    )

# ── Recommendation Routes (Protected) ─────────────────────────────────

@app.get("/api/v1/recommendations/use-cases")
async def recommendations_use_cases(request: Request):
    """Get use cases for recommendations"""
    return await proxy_request(request, "recommendations", "/api/v1/recommendations/use-cases")

@app.api_route("/api/v1/recommendations/{path:path}", methods=["GET", "POST"])
async def recommendations_proxy(request: Request, path: str):
    return await proxy_request(
        request, "recommendations", f"/api/v1/recommendations/{path}",
        inject_user_id=True,
        require_authentication=False  # Recommendations can work with or without user
    )

# ── News Routes (Public) ──────────────────────────────────────────────

@app.get("/api/v1/news/feed")
async def news_feed(request: Request):
    """Get news feed"""
    return await proxy_request(request, "news", "/api/v1/news/feed")

@app.get("/api/v1/news/trending")
async def news_trending(request: Request):
    """Get trending news"""
    return await proxy_request(request, "news", "/api/v1/news/trending")

@app.get("/api/v1/news/breaking")
async def news_breaking(request: Request):
    """Get breaking news"""
    return await proxy_request(request, "news", "/api/v1/news/breaking")

@app.api_route("/api/v1/news/{path:path}", methods=["GET", "POST"])
async def news_proxy(request: Request, path: str):
    return await proxy_request(request, "news", f"/api/v1/news/{path}")

# ── AI Assistant / Proxy Routes (Protected) ──────────────────────────

@app.api_route("/api/v1/assistant/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def assistant_proxy(request: Request, path: str):
    """Assistant routes - all require authentication"""
    return await proxy_request(
        request, "ai-proxy", f"/api/v1/assistant/{path}",
        inject_user_id=True,
        require_authentication=True
    )

@app.post("/api/v1/chat/stream")
async def chat_stream_proxy(request: Request):
    """
    SSE streaming chat proxy.
    Streams the ai-proxy response directly to the client without buffering.
    """
    user = await require_auth(request)
    user_id = user.get("sub")

    url = f"{SERVICES['ai-proxy']}/api/v1/chat/stream"
    headers = dict(request.headers)
    headers.pop("host", None)
    headers["X-User-ID"] = user_id or ""
    headers["X-User-Email"] = user.get("email", "")
    headers["X-User-Role"] = user.get("role", "user")
    body = await request.body()

    async def stream_generator():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", url, headers=headers, content=body) as resp:
                    async for chunk in resp.aiter_bytes():
                        yield chunk
        except Exception as e:
            error = {"error": {"code": "AC_503", "message": f"Streaming proxy error: {str(e)[:200]}"}}
            yield f"data: {json.dumps(error)}\n\n".encode()
            yield b"data: [DONE]\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@app.api_route("/api/v1/chat/{path:path}", methods=["POST"])
async def chat_proxy(request: Request, path: str):
    """Chat completion routes - require authentication"""
    return await proxy_request(
        request, "ai-proxy", f"/api/v1/chat/{path}",
        inject_user_id=True,
        require_authentication=True
    )

# ── Billing Routes (Mixed Auth) ───────────────────────────────────────

@app.get("/api/v1/billing/plans")
async def billing_plans(request: Request):
    """Get billing plans (public)"""
    return await proxy_request(request, "billing", "/api/v1/billing/plans")

@app.get("/api/v1/billing/usage")
async def billing_usage(request: Request):
    """Get billing usage"""
    return await proxy_request(
        request, "billing", "/api/v1/billing/usage",
        inject_user_id=True,
        require_authentication=True
    )

@app.get("/api/v1/billing/invoices")
async def billing_invoices(request: Request):
    """Get billing invoices"""
    return await proxy_request(
        request, "billing", "/api/v1/billing/invoices",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/billing/{path:path}", methods=["GET", "POST"])
async def billing_proxy(request: Request, path: str):
    """Billing routes - plans is public, others require authentication"""
    # Plans endpoint is public for pricing page
    if path == "plans":
        return await proxy_request(request, "billing", f"/api/v1/billing/{path}")

    # All other billing endpoints require auth
    return await proxy_request(
        request, "billing", f"/api/v1/billing/{path}",
        inject_user_id=True,
        require_authentication=True
    )

# ── Storage Routes (Protected) ───────────────────────────────────────

@app.api_route("/api/v1/storage/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def storage_proxy(request: Request, path: str):
    """Storage routes - require authentication"""
    return await proxy_request(
        request, "storage", f"/api/v1/storage/{path}",
        inject_user_id=True,
        require_authentication=True
    )

# ── Workspace & AI Assistant Routes (Protected) ──────────────────────

# Explicit root routes for workspace service
@app.api_route("/api/v1/workspaces", methods=["GET", "POST"])
async def workspaces_list(request: Request):
    """List workspaces or create new workspace"""
    return await proxy_request(
        request, "workspace", "/api/v1/workspaces",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/tasks", methods=["GET", "POST"])
async def tasks_list(request: Request):
    """List tasks or create new task"""
    return await proxy_request(
        request, "workspace", "/api/v1/tasks",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/agents", methods=["GET", "POST"])
async def agents_list(request: Request):
    """List agents or create new agent"""
    return await proxy_request(
        request, "workspace", "/api/v1/agents",
        inject_user_id=True,
        require_authentication=True
    )

@app.get("/api/v1/templates")
async def templates_list(request: Request):
    """List task templates"""
    return await proxy_request(
        request, "workspace", "/api/v1/templates",
        inject_user_id=True,
        require_authentication=False
    )

@app.get("/api/v1/agent-tools")
async def agent_tools_list(request: Request):
    """List agent tools"""
    return await proxy_request(request, "workspace", "/api/v1/agent-tools")

@app.get("/api/v1/stats")
async def workspace_stats(request: Request):
    """Get user workspace stats"""
    return await proxy_request(
        request, "workspace", "/api/v1/stats",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/workspaces/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def workspaces_proxy(request: Request, path: str):
    """Workspace routes - require authentication"""
    return await proxy_request(
        request, "workspace", f"/api/v1/workspaces/{path}",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/tasks/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def tasks_proxy(request: Request, path: str):
    """AI Tasks routes - require authentication"""
    return await proxy_request(
        request, "workspace", f"/api/v1/tasks/{path}",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/templates/{path:path}", methods=["GET", "POST"])
async def templates_proxy(request: Request, path: str):
    """Task templates routes"""
    return await proxy_request(
        request, "workspace", f"/api/v1/templates/{path}",
        inject_user_id=True,
        require_authentication=False  # Templates can be viewed without auth
    )

@app.api_route("/api/v1/routing/{path:path}", methods=["GET"])
async def routing_proxy(request: Request, path: str):
    """AI routing rules"""
    return await proxy_request(request, "workspace", f"/api/v1/routing/{path}")

@app.api_route("/api/v1/agents/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def agents_proxy(request: Request, path: str):
    """Custom agents routes - require authentication"""
    return await proxy_request(
        request, "workspace", f"/api/v1/agents/{path}",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/agent-tools/{path:path}", methods=["GET"])
async def agent_tools_proxy(request: Request, path: str):
    """Agent tools routes"""
    return await proxy_request(request, "workspace", f"/api/v1/agent-tools/{path}")

@app.api_route("/api/v1/conversations/{path:path}", methods=["GET", "POST", "DELETE"])
async def conversations_proxy(request: Request, path: str):
    """Agent conversations routes - require authentication"""
    return await proxy_request(
        request, "workspace", f"/api/v1/conversations/{path}",
        inject_user_id=True,
        require_authentication=True
    )

# ── Orchestrator Routes (Protected) ──────────────────────────────────

@app.api_route("/api/v1/orchestrate", methods=["POST"])
async def orchestrate_proxy(request: Request):
    """Main orchestration endpoint - coordinate multiple agents"""
    return await proxy_request(
        request, "orchestrator", "/api/v1/orchestrate",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/smart-query", methods=["POST"])
async def smart_query_proxy(request: Request):
    """Smart query - auto-determines best orchestration approach"""
    return await proxy_request(
        request, "orchestrator", "/api/v1/smart-query",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/workflow", methods=["POST"])
async def workflow_proxy(request: Request):
    """Custom multi-agent workflows"""
    return await proxy_request(
        request, "orchestrator", "/api/v1/workflow",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/expert-agents", methods=["GET"])
async def expert_agents_proxy(request: Request):
    """List available expert agents"""
    return await proxy_request(request, "orchestrator", "/api/v1/expert-agents")

@app.api_route("/api/v1/compare-agents", methods=["POST"])
async def compare_agents_proxy(request: Request):
    """Compare responses from multiple agents"""
    return await proxy_request(
        request, "orchestrator", "/api/v1/compare-agents",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/fact-check", methods=["POST"])
async def fact_check_proxy(request: Request):
    """Fact-check content using multiple agents"""
    return await proxy_request(
        request, "orchestrator", "/api/v1/fact-check",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/improve-content", methods=["POST"])
async def improve_content_proxy(request: Request):
    """Improve content using expert agents"""
    return await proxy_request(
        request, "orchestrator", "/api/v1/improve-content",
        inject_user_id=True,
        require_authentication=True
    )

# ── Comparison Endpoint (aggregated) ─────────────────────────────────

@app.get("/api/v1/compare")
async def compare_models(model_ids: str, request: Request):
    """Compare multiple AI models side by side"""
    ids = model_ids.split(",")
    if len(ids) < 2 or len(ids) > 5:
        raise HTTPException(status_code=400, detail="Provide 2-5 model IDs")

    user = await get_current_user(request)
    client = app.state.http_client
    models_data = []

    for model_id in ids:
        try:
            resp = await client.get(f"{SERVICES['models']}/api/v1/models/{model_id.strip()}")
            if resp.status_code == 200:
                models_data.append(resp.json())
        except Exception:
            continue

    return {"comparison": models_data, "count": len(models_data)}

# ── Admin Routes (Admin Only) ────────────────────────────────────────

@app.api_route("/api/v1/admin/{service}/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def admin_proxy(request: Request, service: str, path: str):
    """Admin routes - require admin role"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Route to appropriate service
    if service in SERVICES:
        return await proxy_request(
            request, service, f"/api/v1/admin/{path}",
            inject_user_id=True,
            require_authentication=True
        )
    raise HTTPException(status_code=404, detail=f"Admin service '{service}' not found")

# ── Cloud IDE Routes (Protected) ──────────────────────────────────

@app.get("/api/v1/ide/templates")
async def ide_templates(request: Request):
    """Get IDE templates (public)"""
    return await proxy_request(request, "ide", "/api/v1/ide/templates")

@app.get("/api/v1/ide/presets")
async def ide_presets(request: Request):
    """Get resource presets (public)"""
    return await proxy_request(request, "ide", "/api/v1/ide/presets")

@app.get("/api/v1/ide/database-types")
async def ide_database_types(request: Request):
    """Get database types (public)"""
    return await proxy_request(request, "ide", "/api/v1/ide/database-types")

@app.api_route("/api/v1/ide/projects", methods=["GET", "POST"])
async def ide_projects_list(request: Request):
    """List or create IDE projects"""
    return await proxy_request(
        request, "ide", "/api/v1/ide/projects",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/ide/projects/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def ide_projects_proxy(request: Request, path: str):
    """IDE project routes - require authentication"""
    return await proxy_request(
        request, "ide", f"/api/v1/ide/projects/{path}",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/ide/databases", methods=["GET", "POST"])
async def ide_databases_list(request: Request):
    """List or create IDE databases"""
    return await proxy_request(
        request, "ide", "/api/v1/ide/databases",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/ide/databases/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def ide_databases_proxy(request: Request, path: str):
    """IDE database routes - require authentication"""
    return await proxy_request(
        request, "ide", f"/api/v1/ide/databases/{path}",
        inject_user_id=True,
        require_authentication=True
    )

@app.api_route("/api/v1/ide/git/{path:path}", methods=["GET", "POST", "DELETE"])
async def ide_git_proxy(request: Request, path: str):
    """IDE Git integration routes - require authentication"""
    return await proxy_request(
        request, "ide", f"/api/v1/ide/git/{path}",
        inject_user_id=True,
        require_authentication=True
    )

@app.get("/api/v1/ide/extensions")
async def ide_extensions(request: Request):
    """Get available VS Code extensions"""
    return await proxy_request(request, "ide", "/api/v1/ide/extensions")

@app.api_route("/api/v1/ide/extensions/{path:path}", methods=["GET", "POST", "DELETE"])
async def ide_extensions_proxy(request: Request, path: str):
    """IDE extensions routes"""
    return await proxy_request(
        request, "ide", f"/api/v1/ide/extensions/{path}",
        inject_user_id=True,
        require_authentication=True
    )

@app.get("/api/v1/ide/usage")
async def ide_usage(request: Request):
    """Get IDE usage statistics for billing"""
    return await proxy_request(
        request, "ide", "/api/v1/ide/usage",
        inject_user_id=True,
        require_authentication=True
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
