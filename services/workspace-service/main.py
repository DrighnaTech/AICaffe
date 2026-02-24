"""
AICaffe Workspace Service - AI Assistant with intelligent routing & Agent Builder
Handles workspaces, AI tasks, category-based model selection, and custom agents
"""
from fastapi import FastAPI, HTTPException, Query, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import asyncpg
import httpx
import uuid
import os
import json

app = FastAPI(title="AICaffe Workspace Service", version="1.0.0")

# ── Configuration ─────────────────────────────────────────────────────────────

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
    "database": os.getenv("DB_NAME", "aicaffe"),
}

# AI Provider URLs
AI_PROXY_URL = os.getenv("AI_PROXY_URL", "http://localhost:8006")

# Task Categories
class TaskCategory(str, Enum):
    content = "content"
    research = "research"
    design = "design"
    development = "development"
    audio = "audio"
    video = "video"
    data = "data"
    translation = "translation"
    assistant = "assistant"
    agent = "agent"

# ── Database ──────────────────────────────────────────────────────────────────

pool: Optional[asyncpg.Pool] = None

async def get_pool():
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(**DB_CONFIG, min_size=5, max_size=20)
    return pool

# ── Schemas ───────────────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    settings: Optional[Dict] = None

class ProjectCreate(BaseModel):
    name: str
    category: TaskCategory
    description: Optional[str] = None
    color: Optional[str] = "#8B5CF6"
    icon: Optional[str] = "folder"

class TaskCreate(BaseModel):
    title: str
    category: TaskCategory
    subcategory: Optional[str] = None
    prompt: str
    workspace_id: Optional[str] = None
    project_id: Optional[str] = None
    model_override: Optional[str] = None
    config: Optional[Dict] = None
    attachments: Optional[List[Dict]] = []

class TaskExecute(BaseModel):
    prompt: str
    category: TaskCategory
    subcategory: Optional[str] = None
    model_override: Optional[str] = None
    stream: bool = False
    config: Optional[Dict] = None

class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    agent_type: str = "assistant"
    system_prompt: str
    primary_model: str = "claude-3-5-sonnet-20241022"
    capabilities: List[str] = []
    tools: List[str] = []
    personality: Optional[Dict] = None
    is_public: bool = False

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    primary_model: Optional[str] = None
    capabilities: Optional[List[str]] = None
    tools: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None

class AgentMessage(BaseModel):
    content: str
    attachments: Optional[List[Dict]] = []

# ── AI Router ─────────────────────────────────────────────────────────────────

class AIRouter:
    """Intelligent model router based on task category"""

    @staticmethod
    async def get_best_model(category: TaskCategory, subcategory: Optional[str] = None) -> Dict:
        """Get the best model for a given category/subcategory"""
        db = await get_pool()
        async with db.acquire() as conn:
            # Try exact match with subcategory first
            if subcategory:
                route = await conn.fetchrow("""
                    SELECT primary_model, primary_provider, fallback_models
                    FROM category_model_routing
                    WHERE category = $1 AND subcategory = $2 AND is_active = TRUE
                    ORDER BY priority DESC LIMIT 1
                """, category.value, subcategory)
                if route:
                    return {
                        "model": route["primary_model"],
                        "provider": route["primary_provider"],
                        "fallbacks": json.loads(route["fallback_models"]) if route["fallback_models"] else []
                    }

            # Fall back to category default
            route = await conn.fetchrow("""
                SELECT primary_model, primary_provider, fallback_models
                FROM category_model_routing
                WHERE category = $1 AND subcategory IS NULL AND is_active = TRUE
                ORDER BY priority DESC LIMIT 1
            """, category.value)

            if route:
                return {
                    "model": route["primary_model"],
                    "provider": route["primary_provider"],
                    "fallbacks": json.loads(route["fallback_models"]) if route["fallback_models"] else []
                }

            # Ultimate fallback
            return {
                "model": "claude-3-5-sonnet-20241022",
                "provider": "anthropic",
                "fallbacks": ["gpt-4o", "gemini-2.0-flash"]
            }

    @staticmethod
    async def get_all_routes() -> List[Dict]:
        """Get all routing rules"""
        db = await get_pool()
        async with db.acquire() as conn:
            routes = await conn.fetch("""
                SELECT category, subcategory, primary_model, primary_provider,
                       fallback_models, priority, is_active
                FROM category_model_routing
                ORDER BY category, priority DESC
            """)
            return [dict(r) for r in routes]

router = AIRouter()

# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "workspace"}

# ══════════════════════════════════════════════════════════════════════════════
# WORKSPACE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/workspaces")
async def list_workspaces(
    user_id: str = Query(..., description="User ID"),
):
    """List all workspaces for a user"""
    db = await get_pool()
    async with db.acquire() as conn:
        workspaces = await conn.fetch("""
            SELECT w.*,
                   (SELECT COUNT(*) FROM ai_tasks WHERE workspace_id = w.id) as task_count,
                   (SELECT COUNT(*) FROM workspace_projects WHERE workspace_id = w.id) as project_count
            FROM workspaces w
            WHERE w.user_id = $1
            ORDER BY w.is_default DESC, w.created_at DESC
        """, user_id)
        return {"workspaces": [dict(w) for w in workspaces]}

@app.post("/api/v1/workspaces", status_code=201)
async def create_workspace(
    data: WorkspaceCreate,
    user_id: str = Query(...),
):
    """Create a new workspace"""
    db = await get_pool()
    async with db.acquire() as conn:
        workspace_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO workspaces (id, user_id, name, description)
            VALUES ($1, $2, $3, $4)
        """, workspace_id, user_id, data.name, data.description)

        workspace = await conn.fetchrow("SELECT * FROM workspaces WHERE id = $1", workspace_id)
        return dict(workspace)

@app.get("/api/v1/workspaces/{workspace_id}")
async def get_workspace(workspace_id: str, user_id: str = Query(...)):
    """Get workspace details"""
    db = await get_pool()
    async with db.acquire() as conn:
        workspace = await conn.fetchrow("""
            SELECT * FROM workspaces WHERE id = $1 AND user_id = $2
        """, workspace_id, user_id)
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")

        projects = await conn.fetch("""
            SELECT * FROM workspace_projects WHERE workspace_id = $1
        """, workspace_id)

        recent_tasks = await conn.fetch("""
            SELECT * FROM ai_tasks WHERE workspace_id = $1
            ORDER BY created_at DESC LIMIT 10
        """, workspace_id)

        return {
            **dict(workspace),
            "projects": [dict(p) for p in projects],
            "recent_tasks": [dict(t) for t in recent_tasks]
        }

@app.put("/api/v1/workspaces/{workspace_id}")
async def update_workspace(workspace_id: str, data: WorkspaceUpdate, user_id: str = Query(...)):
    """Update workspace"""
    db = await get_pool()
    async with db.acquire() as conn:
        workspace = await conn.fetchrow(
            "SELECT * FROM workspaces WHERE id = $1 AND user_id = $2", workspace_id, user_id
        )
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")

        updates = []
        params = []
        idx = 1

        if data.name:
            updates.append(f"name = ${idx}")
            params.append(data.name)
            idx += 1
        if data.description is not None:
            updates.append(f"description = ${idx}")
            params.append(data.description)
            idx += 1
        if data.settings is not None:
            updates.append(f"settings = ${idx}")
            params.append(json.dumps(data.settings))
            idx += 1

        if updates:
            updates.append(f"updated_at = NOW()")
            params.append(workspace_id)
            query = f"UPDATE workspaces SET {', '.join(updates)} WHERE id = ${idx}"
            await conn.execute(query, *params)

        return {"message": "Workspace updated"}

@app.delete("/api/v1/workspaces/{workspace_id}")
async def delete_workspace(workspace_id: str, user_id: str = Query(...)):
    """Delete workspace"""
    db = await get_pool()
    async with db.acquire() as conn:
        workspace = await conn.fetchrow(
            "SELECT * FROM workspaces WHERE id = $1 AND user_id = $2", workspace_id, user_id
        )
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        if workspace["is_default"]:
            raise HTTPException(status_code=400, detail="Cannot delete default workspace")

        await conn.execute("DELETE FROM workspaces WHERE id = $1", workspace_id)
        return {"message": "Workspace deleted"}

# ── Projects ──────────────────────────────────────────────────────────────────

@app.get("/api/v1/workspaces/{workspace_id}/projects")
async def list_projects(workspace_id: str, user_id: str = Query(...)):
    """List projects in a workspace"""
    db = await get_pool()
    async with db.acquire() as conn:
        projects = await conn.fetch("""
            SELECT p.*,
                   (SELECT COUNT(*) FROM ai_tasks WHERE project_id = p.id) as task_count
            FROM workspace_projects p
            JOIN workspaces w ON p.workspace_id = w.id
            WHERE p.workspace_id = $1 AND w.user_id = $2
            ORDER BY p.category, p.created_at
        """, workspace_id, user_id)
        return {"projects": [dict(p) for p in projects]}

@app.post("/api/v1/workspaces/{workspace_id}/projects", status_code=201)
async def create_project(workspace_id: str, data: ProjectCreate, user_id: str = Query(...)):
    """Create a project in a workspace"""
    db = await get_pool()
    async with db.acquire() as conn:
        workspace = await conn.fetchrow(
            "SELECT * FROM workspaces WHERE id = $1 AND user_id = $2", workspace_id, user_id
        )
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")

        project_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO workspace_projects (id, workspace_id, name, category, description, color, icon)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, project_id, workspace_id, data.name, data.category.value,
            data.description, data.color, data.icon)

        project = await conn.fetchrow("SELECT * FROM workspace_projects WHERE id = $1", project_id)
        return dict(project)

# ══════════════════════════════════════════════════════════════════════════════
# AI TASK ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/tasks")
async def list_tasks(
    user_id: str = Query(...),
    category: Optional[TaskCategory] = None,
    workspace_id: Optional[str] = None,
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List AI tasks with filters"""
    db = await get_pool()
    async with db.acquire() as conn:
        query = "SELECT * FROM ai_tasks WHERE user_id = $1"
        params = [user_id]
        idx = 2

        if category:
            query += f" AND category = ${idx}"
            params.append(category.value)
            idx += 1
        if workspace_id:
            query += f" AND workspace_id = ${idx}"
            params.append(workspace_id)
            idx += 1
        if project_id:
            query += f" AND project_id = ${idx}"
            params.append(project_id)
            idx += 1
        if status:
            query += f" AND status = ${idx}"
            params.append(status)
            idx += 1

        query += f" ORDER BY created_at DESC LIMIT ${idx} OFFSET ${idx + 1}"
        params.extend([limit, offset])

        tasks = await conn.fetch(query, *params)

        # Get total count
        count_query = "SELECT COUNT(*) FROM ai_tasks WHERE user_id = $1"
        count_params = [user_id]
        if category:
            count_query += " AND category = $2"
            count_params.append(category.value)

        total = await conn.fetchval(count_query, *count_params)

        return {
            "tasks": [dict(t) for t in tasks],
            "total": total,
            "limit": limit,
            "offset": offset
        }

@app.post("/api/v1/tasks", status_code=201)
async def create_task(data: TaskCreate, user_id: str = Query(...)):
    """Create and execute an AI task"""
    db = await get_pool()

    # Get optimal model for this category
    model_info = await router.get_best_model(data.category, data.subcategory)
    model = data.model_override or model_info["model"]
    provider = model_info["provider"]

    async with db.acquire() as conn:
        task_id = str(uuid.uuid4())

        # Insert task
        await conn.execute("""
            INSERT INTO ai_tasks (
                id, user_id, workspace_id, project_id, title, category, subcategory,
                prompt, model_used, provider, model_config, status, attachments, started_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'processing', $12, NOW())
        """, task_id, user_id, data.workspace_id, data.project_id, data.title,
            data.category.value, data.subcategory, data.prompt, model, provider,
            json.dumps(data.config or {}), json.dumps(data.attachments or []))

        # Execute AI call via ai-proxy
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{AI_PROXY_URL}/api/v1/chat/completions",
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": data.prompt}],
                        "user_id": user_id,
                        **(data.config or {})
                    },
                    headers={"X-User-ID": user_id}
                )

                if response.status_code == 200:
                    result = response.json()
                    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                    usage = result.get("usage", {})

                    # Update task with result
                    await conn.execute("""
                        UPDATE ai_tasks SET
                            status = 'completed',
                            result = $1,
                            tokens_input = $2,
                            tokens_output = $3,
                            tokens_total = $4,
                            completed_at = NOW(),
                            updated_at = NOW()
                        WHERE id = $5
                    """, content, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0),
                        usage.get("total_tokens", 0), task_id)
                else:
                    await conn.execute("""
                        UPDATE ai_tasks SET status = 'failed', updated_at = NOW() WHERE id = $1
                    """, task_id)
        except Exception as e:
            await conn.execute("""
                UPDATE ai_tasks SET status = 'failed', result = $1, updated_at = NOW() WHERE id = $2
            """, str(e), task_id)

        # Return task
        task = await conn.fetchrow("SELECT * FROM ai_tasks WHERE id = $1", task_id)
        return dict(task)

@app.post("/api/v1/tasks/execute")
async def execute_quick_task(data: TaskExecute, user_id: str = Query(...)):
    """Quick execute without saving to workspace"""
    model_info = await router.get_best_model(data.category, data.subcategory)
    model = data.model_override or model_info["model"]

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{AI_PROXY_URL}/api/v1/chat/completions",
            json={
                "model": model,
                "messages": [{"role": "user", "content": data.prompt}],
                "user_id": user_id,
                "stream": data.stream,
                **(data.config or {})
            },
            headers={"X-User-ID": user_id}
        )

        if response.status_code == 200:
            return {
                "model_used": model,
                "provider": model_info["provider"],
                "result": response.json()
            }
        else:
            raise HTTPException(status_code=response.status_code, detail="AI execution failed")

@app.get("/api/v1/tasks/{task_id}")
async def get_task(task_id: str, user_id: str = Query(...)):
    """Get task details"""
    db = await get_pool()
    async with db.acquire() as conn:
        task = await conn.fetchrow(
            "SELECT * FROM ai_tasks WHERE id = $1 AND user_id = $2", task_id, user_id
        )
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return dict(task)

@app.post("/api/v1/tasks/{task_id}/rate")
async def rate_task(task_id: str, rating: int = Query(ge=1, le=5), feedback: Optional[str] = None, user_id: str = Query(...)):
    """Rate a completed task"""
    db = await get_pool()
    async with db.acquire() as conn:
        await conn.execute("""
            UPDATE ai_tasks SET user_rating = $1, user_feedback = $2, updated_at = NOW()
            WHERE id = $3 AND user_id = $4
        """, rating, feedback, task_id, user_id)
        return {"message": "Rating saved"}

# ── Templates ─────────────────────────────────────────────────────────────────

@app.get("/api/v1/templates")
async def list_templates(
    category: Optional[TaskCategory] = None,
    user_id: Optional[str] = None,
):
    """List task templates"""
    db = await get_pool()
    async with db.acquire() as conn:
        if user_id:
            # User templates + public templates
            query = """
                SELECT * FROM task_templates
                WHERE is_public = TRUE OR user_id = $1
            """
            params = [user_id]
        else:
            # Only public templates
            query = "SELECT * FROM task_templates WHERE is_public = TRUE"
            params = []

        if category:
            query += f" AND category = ${len(params) + 1}"
            params.append(category.value)

        query += " ORDER BY usage_count DESC"
        templates = await conn.fetch(query, *params)
        return {"templates": [dict(t) for t in templates]}

@app.get("/api/v1/templates/{template_id}")
async def get_template(template_id: str):
    """Get template details"""
    db = await get_pool()
    async with db.acquire() as conn:
        template = await conn.fetchrow("SELECT * FROM task_templates WHERE id = $1", template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return dict(template)

# ── Routing ───────────────────────────────────────────────────────────────────

@app.get("/api/v1/routing")
async def get_routing_rules():
    """Get all AI model routing rules"""
    routes = await router.get_all_routes()
    return {"routes": routes}

@app.get("/api/v1/routing/recommend")
async def recommend_model(
    category: TaskCategory,
    subcategory: Optional[str] = None,
):
    """Get recommended model for a category"""
    model_info = await router.get_best_model(category, subcategory)
    return model_info

# ══════════════════════════════════════════════════════════════════════════════
# AGENT BUILDER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/agents")
async def list_agents(
    user_id: str = Query(...),
    include_public: bool = Query(True),
):
    """List agents"""
    db = await get_pool()
    async with db.acquire() as conn:
        if include_public:
            agents = await conn.fetch("""
                SELECT * FROM custom_agents
                WHERE user_id = $1 OR is_public = TRUE
                ORDER BY created_at DESC
            """, user_id)
        else:
            agents = await conn.fetch("""
                SELECT * FROM custom_agents WHERE user_id = $1
                ORDER BY created_at DESC
            """, user_id)
        return {"agents": [dict(a) for a in agents]}

@app.post("/api/v1/agents", status_code=201)
async def create_agent(data: AgentCreate, user_id: str = Query(...)):
    """Create a custom agent"""
    db = await get_pool()
    async with db.acquire() as conn:
        agent_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO custom_agents (
                id, user_id, name, description, agent_type, system_prompt,
                primary_model, capabilities, tools, personality, is_public
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        """, agent_id, user_id, data.name, data.description, data.agent_type,
            data.system_prompt, data.primary_model, json.dumps(data.capabilities),
            json.dumps(data.tools), json.dumps(data.personality or {}), data.is_public)

        agent = await conn.fetchrow("SELECT * FROM custom_agents WHERE id = $1", agent_id)
        return dict(agent)

@app.get("/api/v1/agents/{agent_id}")
async def get_agent(agent_id: str, user_id: str = Query(...)):
    """Get agent details"""
    db = await get_pool()
    async with db.acquire() as conn:
        agent = await conn.fetchrow("""
            SELECT * FROM custom_agents
            WHERE id = $1 AND (user_id = $2 OR is_public = TRUE)
        """, agent_id, user_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        return dict(agent)

@app.put("/api/v1/agents/{agent_id}")
async def update_agent(agent_id: str, data: AgentUpdate, user_id: str = Query(...)):
    """Update an agent"""
    db = await get_pool()
    async with db.acquire() as conn:
        agent = await conn.fetchrow(
            "SELECT * FROM custom_agents WHERE id = $1 AND user_id = $2", agent_id, user_id
        )
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        updates = []
        params = []
        idx = 1

        for field in ["name", "description", "system_prompt", "primary_model", "is_public", "is_active"]:
            value = getattr(data, field, None)
            if value is not None:
                updates.append(f"{field} = ${idx}")
                params.append(value)
                idx += 1

        if data.capabilities is not None:
            updates.append(f"capabilities = ${idx}")
            params.append(json.dumps(data.capabilities))
            idx += 1
        if data.tools is not None:
            updates.append(f"tools = ${idx}")
            params.append(json.dumps(data.tools))
            idx += 1

        if updates:
            updates.append("updated_at = NOW()")
            params.append(agent_id)
            query = f"UPDATE custom_agents SET {', '.join(updates)} WHERE id = ${idx}"
            await conn.execute(query, *params)

        return {"message": "Agent updated"}

@app.delete("/api/v1/agents/{agent_id}")
async def delete_agent(agent_id: str, user_id: str = Query(...)):
    """Delete an agent"""
    db = await get_pool()
    async with db.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM custom_agents WHERE id = $1 AND user_id = $2", agent_id, user_id
        )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Agent not found")
        return {"message": "Agent deleted"}

# ── Agent Tools ───────────────────────────────────────────────────────────────

@app.get("/api/v1/agent-tools")
async def list_agent_tools(category: Optional[str] = None):
    """List available agent tools"""
    db = await get_pool()
    async with db.acquire() as conn:
        if category:
            tools = await conn.fetch(
                "SELECT * FROM agent_tools WHERE category = $1 AND is_enabled = TRUE", category
            )
        else:
            tools = await conn.fetch("SELECT * FROM agent_tools WHERE is_enabled = TRUE")
        return {"tools": [dict(t) for t in tools]}

# ── Agent Conversations ───────────────────────────────────────────────────────

@app.get("/api/v1/agents/{agent_id}/conversations")
async def list_agent_conversations(agent_id: str, user_id: str = Query(...)):
    """List conversations with an agent"""
    db = await get_pool()
    async with db.acquire() as conn:
        conversations = await conn.fetch("""
            SELECT * FROM agent_conversations
            WHERE agent_id = $1 AND user_id = $2
            ORDER BY updated_at DESC
        """, agent_id, user_id)
        return {"conversations": [dict(c) for c in conversations]}

@app.post("/api/v1/agents/{agent_id}/conversations", status_code=201)
async def create_agent_conversation(agent_id: str, user_id: str = Query(...)):
    """Start a new conversation with an agent"""
    db = await get_pool()
    async with db.acquire() as conn:
        # Verify agent exists
        agent = await conn.fetchrow("""
            SELECT * FROM custom_agents WHERE id = $1 AND (user_id = $2 OR is_public = TRUE)
        """, agent_id, user_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        convo_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO agent_conversations (id, user_id, agent_id, title)
            VALUES ($1, $2, $3, 'New Conversation')
        """, convo_id, user_id, agent_id)

        convo = await conn.fetchrow("SELECT * FROM agent_conversations WHERE id = $1", convo_id)
        return dict(convo)

@app.get("/api/v1/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, user_id: str = Query(...)):
    """Get conversation with messages"""
    db = await get_pool()
    async with db.acquire() as conn:
        convo = await conn.fetchrow("""
            SELECT ac.*, ca.name as agent_name, ca.system_prompt, ca.primary_model
            FROM agent_conversations ac
            JOIN custom_agents ca ON ac.agent_id = ca.id
            WHERE ac.id = $1 AND ac.user_id = $2
        """, conversation_id, user_id)
        if not convo:
            raise HTTPException(status_code=404, detail="Conversation not found")

        messages = await conn.fetch("""
            SELECT * FROM agent_messages WHERE conversation_id = $1 ORDER BY created_at
        """, conversation_id)

        return {
            **dict(convo),
            "messages": [dict(m) for m in messages]
        }

@app.post("/api/v1/conversations/{conversation_id}/messages")
async def send_message_to_agent(
    conversation_id: str,
    data: AgentMessage,
    user_id: str = Query(...)
):
    """Send a message to an agent"""
    db = await get_pool()
    async with db.acquire() as conn:
        # Get conversation and agent
        convo = await conn.fetchrow("""
            SELECT ac.*, ca.system_prompt, ca.primary_model, ca.tools, ca.capabilities
            FROM agent_conversations ac
            JOIN custom_agents ca ON ac.agent_id = ca.id
            WHERE ac.id = $1 AND ac.user_id = $2
        """, conversation_id, user_id)
        if not convo:
            raise HTTPException(status_code=404, detail="Conversation not found")

        # Get message history
        history = await conn.fetch("""
            SELECT role, content FROM agent_messages WHERE conversation_id = $1 ORDER BY created_at
        """, conversation_id)

        # Build messages
        messages = [{"role": "system", "content": convo["system_prompt"]}]
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": data.content})

        # Save user message
        user_msg_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO agent_messages (id, conversation_id, role, content, attachments)
            VALUES ($1, $2, 'user', $3, $4)
        """, user_msg_id, conversation_id, data.content, json.dumps(data.attachments or []))

        # Call AI
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{AI_PROXY_URL}/api/v1/chat/completions",
                    json={
                        "model": convo["primary_model"],
                        "messages": messages,
                        "user_id": user_id
                    },
                    headers={"X-User-ID": user_id}
                )

                if response.status_code == 200:
                    result = response.json()
                    assistant_content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                    usage = result.get("usage", {})

                    # Save assistant message
                    assistant_msg_id = str(uuid.uuid4())
                    await conn.execute("""
                        INSERT INTO agent_messages (id, conversation_id, role, content, tokens, model_used)
                        VALUES ($1, $2, 'assistant', $3, $4, $5)
                    """, assistant_msg_id, conversation_id, assistant_content,
                        usage.get("total_tokens", 0), convo["primary_model"])

                    # Update conversation
                    await conn.execute("""
                        UPDATE agent_conversations SET
                            message_count = message_count + 2,
                            tokens_used = tokens_used + $1,
                            updated_at = NOW()
                        WHERE id = $2
                    """, usage.get("total_tokens", 0), conversation_id)

                    # Update agent stats
                    await conn.execute("""
                        UPDATE custom_agents SET
                            total_messages = total_messages + 2,
                            updated_at = NOW()
                        WHERE id = $1
                    """, convo["agent_id"])

                    return {
                        "user_message": {"id": user_msg_id, "content": data.content},
                        "assistant_message": {"id": assistant_msg_id, "content": assistant_content},
                        "tokens_used": usage.get("total_tokens", 0)
                    }
                else:
                    raise HTTPException(status_code=500, detail="AI call failed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/v1/stats")
async def get_user_stats(user_id: str = Query(...)):
    """Get user workspace stats"""
    db = await get_pool()
    async with db.acquire() as conn:
        stats = {}

        # Task counts by category
        task_counts = await conn.fetch("""
            SELECT category, COUNT(*) as count,
                   SUM(tokens_total) as tokens,
                   AVG(user_rating) as avg_rating
            FROM ai_tasks WHERE user_id = $1
            GROUP BY category
        """, user_id)
        stats["tasks_by_category"] = {r["category"]: dict(r) for r in task_counts}

        # Total tasks
        stats["total_tasks"] = await conn.fetchval(
            "SELECT COUNT(*) FROM ai_tasks WHERE user_id = $1", user_id
        )

        # Agent count
        stats["agents_created"] = await conn.fetchval(
            "SELECT COUNT(*) FROM custom_agents WHERE user_id = $1", user_id
        )

        # Workspace count
        stats["workspaces"] = await conn.fetchval(
            "SELECT COUNT(*) FROM workspaces WHERE user_id = $1", user_id
        )

        return stats


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8009)
