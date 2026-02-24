"""
AICaffe Cloud IDE Service - VS Code Workspaces & Database Provisioning
Manages cloud development environments, databases, and GitHub integration
Port: 8011
"""
from fastapi import FastAPI, HTTPException, Query, Header, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import asyncpg
import httpx
import uuid
import os
import json
import secrets
import asyncio
from cryptography.fernet import Fernet

app = FastAPI(title="AICaffe Cloud IDE Service", version="1.0.0")

# ── Configuration ─────────────────────────────────────────────────────────────

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

# Service URLs
TOKEN_SERVICE_URL = os.getenv("TOKEN_SERVICE_URL", "http://localhost:8003")
DOCKER_SOCKET = os.getenv("DOCKER_SOCKET", "/var/run/docker.sock")

# IDE Configuration
IDE_BASE_DOMAIN = os.getenv("IDE_BASE_DOMAIN", "ide.aicaffe.local")
IDE_PORT_RANGE_START = int(os.getenv("IDE_PORT_RANGE_START", 10000))
IDE_PORT_RANGE_END = int(os.getenv("IDE_PORT_RANGE_END", 11000))

# GitHub OAuth
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")

# ── Database (Singleton Pool) ─────────────────────────────────────────────────

class Database:
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

# ── Encryption Helpers ────────────────────────────────────────────────────────

def encrypt_value(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()

def decrypt_value(encrypted: str) -> str:
    return fernet.decrypt(encrypted.encode()).decode()

# ── Auth Helper ───────────────────────────────────────────────────────────────

def get_user_id(
    user_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
) -> str:
    uid = x_user_id or user_id
    if not uid:
        raise HTTPException(status_code=401, detail="User ID required")
    return uid

# ── Enums ─────────────────────────────────────────────────────────────────────

class ProjectStatus(str, Enum):
    creating = "creating"
    starting = "starting"
    running = "running"
    stopping = "stopping"
    stopped = "stopped"
    hibernating = "hibernating"
    error = "error"
    deleted = "deleted"

class GitProvider(str, Enum):
    github = "github"
    gitlab = "gitlab"
    bitbucket = "bitbucket"
    azure = "azure"

# ── Schemas ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    template_slug: Optional[str] = "blank"
    resource_preset_slug: str = "small"
    git_repo_url: Optional[str] = None
    git_branch: Optional[str] = "main"
    environment_vars: Optional[Dict[str, str]] = {}

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    resource_preset_slug: Optional[str] = None
    environment_vars: Optional[Dict[str, str]] = None
    vscode_extensions: Optional[List[str]] = None
    auto_stop_minutes: Optional[int] = None

class DatabaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    database_type_slug: str
    project_id: Optional[str] = None
    storage_gb: int = Field(default=1, ge=1, le=100)

class GitHubConnect(BaseModel):
    code: str  # OAuth authorization code

# ══════════════════════════════════════════════════════════════════════════════
# HEALTH & INFO
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "cloud-ide"}

# ══════════════════════════════════════════════════════════════════════════════
# TEMPLATES & PRESETS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/ide/templates")
async def list_templates(category: Optional[str] = None):
    """List available IDE templates"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if category:
            templates = await conn.fetch("""
                SELECT * FROM ide_templates WHERE is_active = TRUE AND category = $1
                ORDER BY sort_order, name
            """, category)
        else:
            templates = await conn.fetch("""
                SELECT * FROM ide_templates WHERE is_active = TRUE
                ORDER BY sort_order, name
            """)
        return {"templates": [dict(t) for t in templates]}

@app.get("/api/v1/ide/templates/{slug}")
async def get_template(slug: str):
    """Get template details"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        template = await conn.fetchrow(
            "SELECT * FROM ide_templates WHERE slug = $1", slug
        )
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return dict(template)

@app.get("/api/v1/ide/presets")
async def list_resource_presets():
    """List available resource presets"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        presets = await conn.fetch("""
            SELECT * FROM ide_resource_presets WHERE is_active = TRUE
            ORDER BY tokens_per_hour
        """)
        return {"presets": [dict(p) for p in presets]}

@app.get("/api/v1/ide/database-types")
async def list_database_types():
    """List available database types"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        types = await conn.fetch("""
            SELECT * FROM database_types WHERE is_active = TRUE
            ORDER BY name
        """)
        return {"database_types": [dict(t) for t in types]}

# ══════════════════════════════════════════════════════════════════════════════
# IDE PROJECTS (CODESPACES)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/ide/projects")
async def list_projects(
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
    status: Optional[str] = None,
):
    """List user's IDE projects"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT p.*, t.name as template_name, t.icon as template_icon,
                   r.name as preset_name, r.cpu_cores, r.memory_mb, r.tokens_per_hour
            FROM ide_projects p
            LEFT JOIN ide_templates t ON p.template_id = t.id
            LEFT JOIN ide_resource_presets r ON p.resource_preset_id = r.id
            WHERE p.user_id = $1 AND p.status != 'deleted'
        """
        params = [uid]

        if status:
            query += " AND p.status = $2"
            params.append(status)

        query += " ORDER BY p.updated_at DESC"

        projects = await conn.fetch(query, *params)
        return {"projects": [dict(p) for p in projects]}

@app.post("/api/v1/ide/projects", status_code=201)
async def create_project(
    data: ProjectCreate,
    background_tasks: BackgroundTasks,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Create a new IDE project"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()

    async with pool.acquire() as conn:
        # Get template
        template = None
        if data.template_slug:
            template = await conn.fetchrow(
                "SELECT * FROM ide_templates WHERE slug = $1 AND is_active = TRUE",
                data.template_slug
            )

        # Get resource preset
        preset = await conn.fetchrow(
            "SELECT * FROM ide_resource_presets WHERE slug = $1 AND is_active = TRUE",
            data.resource_preset_slug
        )
        if not preset:
            raise HTTPException(status_code=400, detail="Invalid resource preset")

        # Generate unique slug
        base_slug = data.name.lower().replace(" ", "-")[:50]
        slug = base_slug
        counter = 1
        while await conn.fetchval(
            "SELECT 1 FROM ide_projects WHERE user_id = $1 AND slug = $2", uid, slug
        ):
            slug = f"{base_slug}-{counter}"
            counter += 1

        # Create project
        project_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO ide_projects (
                id, user_id, template_id, name, slug, description,
                resource_preset_id, environment_vars, git_repo_url, git_branch,
                vscode_extensions, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'creating')
        """, project_id, uid,
            template["id"] if template else None,
            data.name, slug, data.description,
            preset["id"],
            json.dumps(data.environment_vars or {}),
            data.git_repo_url, data.git_branch,
            template["default_extensions"] if template else []
        )

        # Get created project
        project = await conn.fetchrow(
            "SELECT * FROM ide_projects WHERE id = $1", project_id
        )

        # Start container in background
        background_tasks.add_task(provision_ide_container, project_id)

        return dict(project)

@app.get("/api/v1/ide/projects/{project_id}")
async def get_project(
    project_id: str,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Get project details"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow("""
            SELECT p.*, t.name as template_name, t.icon as template_icon,
                   t.docker_image, r.name as preset_name, r.cpu_cores,
                   r.memory_mb, r.storage_gb, r.tokens_per_hour
            FROM ide_projects p
            LEFT JOIN ide_templates t ON p.template_id = t.id
            LEFT JOIN ide_resource_presets r ON p.resource_preset_id = r.id
            WHERE p.id = $1 AND p.user_id = $2
        """, project_id, uid)

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get connected databases
        databases = await conn.fetch("""
            SELECT d.*, dt.name as type_name, dt.engine, dt.icon
            FROM provisioned_databases d
            JOIN database_types dt ON d.database_type_id = dt.id
            WHERE d.project_id = $1 AND d.status != 'deleted'
        """, project_id)

        # Get current session if running
        session = None
        if project["status"] == "running":
            session = await conn.fetchrow("""
                SELECT * FROM ide_sessions
                WHERE project_id = $1 AND ended_at IS NULL
                ORDER BY started_at DESC LIMIT 1
            """, project_id)

        result = dict(project)
        result["databases"] = [dict(d) for d in databases]
        result["current_session"] = dict(session) if session else None

        return result

@app.put("/api/v1/ide/projects/{project_id}")
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Update project settings"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow(
            "SELECT * FROM ide_projects WHERE id = $1 AND user_id = $2",
            project_id, uid
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

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
        if data.environment_vars is not None:
            updates.append(f"environment_vars = ${idx}")
            params.append(json.dumps(data.environment_vars))
            idx += 1
        if data.vscode_extensions is not None:
            updates.append(f"vscode_extensions = ${idx}")
            params.append(data.vscode_extensions)
            idx += 1
        if data.auto_stop_minutes is not None:
            updates.append(f"auto_stop_minutes = ${idx}")
            params.append(data.auto_stop_minutes)
            idx += 1

        if data.resource_preset_slug:
            preset = await conn.fetchrow(
                "SELECT id FROM ide_resource_presets WHERE slug = $1",
                data.resource_preset_slug
            )
            if preset:
                updates.append(f"resource_preset_id = ${idx}")
                params.append(preset["id"])
                idx += 1

        if updates:
            updates.append("updated_at = NOW()")
            params.append(project_id)
            await conn.execute(
                f"UPDATE ide_projects SET {', '.join(updates)} WHERE id = ${idx}",
                *params
            )

        return {"message": "Project updated"}

@app.delete("/api/v1/ide/projects/{project_id}")
async def delete_project(
    project_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Delete a project"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow(
            "SELECT * FROM ide_projects WHERE id = $1 AND user_id = $2",
            project_id, uid
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Mark as deleted
        await conn.execute(
            "UPDATE ide_projects SET status = 'deleted', updated_at = NOW() WHERE id = $1",
            project_id
        )

        # Stop container in background
        if project["container_id"]:
            background_tasks.add_task(stop_ide_container, project_id)

        return {"message": "Project deleted"}

# ══════════════════════════════════════════════════════════════════════════════
# PROJECT LIFECYCLE (START/STOP)
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/ide/projects/{project_id}/start")
async def start_project(
    project_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Start IDE container"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow("""
            SELECT p.*, r.tokens_per_hour
            FROM ide_projects p
            JOIN ide_resource_presets r ON p.resource_preset_id = r.id
            WHERE p.id = $1 AND p.user_id = $2
        """, project_id, uid)

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        if project["status"] == "running":
            return {"message": "Project already running", "url": project["container_url"]}

        if project["status"] not in ["stopped", "error", "hibernating"]:
            raise HTTPException(status_code=400, detail=f"Cannot start project in {project['status']} state")

        # Check user has enough tokens (at least 1 hour worth)
        required_tokens = project["tokens_per_hour"]
        # TODO: Actually check token balance via token service

        # Update status
        await conn.execute(
            "UPDATE ide_projects SET status = 'starting', updated_at = NOW() WHERE id = $1",
            project_id
        )

        # Start container in background
        background_tasks.add_task(start_ide_container, project_id)

        return {"message": "Starting project...", "status": "starting"}

@app.post("/api/v1/ide/projects/{project_id}/stop")
async def stop_project(
    project_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Stop IDE container"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow(
            "SELECT * FROM ide_projects WHERE id = $1 AND user_id = $2",
            project_id, uid
        )

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        if project["status"] != "running":
            raise HTTPException(status_code=400, detail="Project is not running")

        # Update status
        await conn.execute(
            "UPDATE ide_projects SET status = 'stopping', updated_at = NOW() WHERE id = $1",
            project_id
        )

        # Stop container in background
        background_tasks.add_task(stop_ide_container, project_id)

        return {"message": "Stopping project...", "status": "stopping"}

@app.get("/api/v1/ide/projects/{project_id}/status")
async def get_project_status(
    project_id: str,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Get current project status"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow("""
            SELECT status, container_url, last_accessed_at, tokens_consumed,
                   total_runtime_minutes
            FROM ide_projects WHERE id = $1 AND user_id = $2
        """, project_id, uid)

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        return dict(project)

# ══════════════════════════════════════════════════════════════════════════════
# DATABASE PROVISIONING
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/ide/databases")
async def list_databases(
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
    project_id: Optional[str] = None,
):
    """List user's provisioned databases"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT d.*, dt.name as type_name, dt.engine, dt.version, dt.icon
            FROM provisioned_databases d
            JOIN database_types dt ON d.database_type_id = dt.id
            WHERE d.user_id = $1 AND d.status != 'deleted'
        """
        params = [uid]

        if project_id:
            query += " AND d.project_id = $2"
            params.append(project_id)

        query += " ORDER BY d.created_at DESC"

        databases = await conn.fetch(query, *params)

        # Don't return encrypted credentials
        result = []
        for db in databases:
            d = dict(db)
            d.pop("password_encrypted", None)
            d.pop("connection_string_encrypted", None)
            result.append(d)

        return {"databases": result}

@app.post("/api/v1/ide/databases", status_code=201)
async def create_database(
    data: DatabaseCreate,
    background_tasks: BackgroundTasks,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Provision a new database"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()

    async with pool.acquire() as conn:
        # Get database type
        db_type = await conn.fetchrow(
            "SELECT * FROM database_types WHERE slug = $1 AND is_active = TRUE",
            data.database_type_slug
        )
        if not db_type:
            raise HTTPException(status_code=400, detail="Invalid database type")

        # Verify project if provided
        if data.project_id:
            project = await conn.fetchrow(
                "SELECT id FROM ide_projects WHERE id = $1 AND user_id = $2",
                data.project_id, uid
            )
            if not project:
                raise HTTPException(status_code=400, detail="Project not found")

        # Generate credentials
        db_id = str(uuid.uuid4())
        db_name = f"db_{db_id[:8]}"
        db_user = f"user_{db_id[:8]}"
        db_password = secrets.token_urlsafe(16)

        # Generate slug
        base_slug = data.name.lower().replace(" ", "-")[:50]
        slug = base_slug
        counter = 1
        while await conn.fetchval(
            "SELECT 1 FROM provisioned_databases WHERE user_id = $1 AND slug = $2",
            uid, slug
        ):
            slug = f"{base_slug}-{counter}"
            counter += 1

        # Create database record
        await conn.execute("""
            INSERT INTO provisioned_databases (
                id, user_id, project_id, database_type_id, name, slug,
                database_name, username, password_encrypted, storage_gb, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'creating')
        """, db_id, uid, data.project_id, db_type["id"], data.name, slug,
            db_name, db_user, encrypt_value(db_password), data.storage_gb
        )

        # Provision in background
        background_tasks.add_task(provision_database_container, db_id)

        database = await conn.fetchrow(
            "SELECT * FROM provisioned_databases WHERE id = $1", db_id
        )

        result = dict(database)
        # Return password only on creation
        result["password"] = db_password
        result.pop("password_encrypted", None)
        result.pop("connection_string_encrypted", None)

        return result

@app.get("/api/v1/ide/databases/{database_id}")
async def get_database(
    database_id: str,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Get database details"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        database = await conn.fetchrow("""
            SELECT d.*, dt.name as type_name, dt.engine, dt.version,
                   dt.connection_string_template
            FROM provisioned_databases d
            JOIN database_types dt ON d.database_type_id = dt.id
            WHERE d.id = $1 AND d.user_id = $2
        """, database_id, uid)

        if not database:
            raise HTTPException(status_code=404, detail="Database not found")

        result = dict(database)
        result.pop("password_encrypted", None)
        result.pop("connection_string_encrypted", None)

        return result

@app.get("/api/v1/ide/databases/{database_id}/credentials")
async def get_database_credentials(
    database_id: str,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Get database connection credentials (sensitive)"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        database = await conn.fetchrow("""
            SELECT d.*, dt.connection_string_template
            FROM provisioned_databases d
            JOIN database_types dt ON d.database_type_id = dt.id
            WHERE d.id = $1 AND d.user_id = $2
        """, database_id, uid)

        if not database:
            raise HTTPException(status_code=404, detail="Database not found")

        password = decrypt_value(database["password_encrypted"]) if database["password_encrypted"] else None

        # Build connection string
        connection_string = database["connection_string_template"].format(
            user=database["username"],
            password=password,
            host=database["host"] or "localhost",
            port=database["port"] or 5432,
            database=database["database_name"]
        ) if password else None

        return {
            "host": database["host"],
            "port": database["port"],
            "database": database["database_name"],
            "username": database["username"],
            "password": password,
            "connection_string": connection_string
        }

@app.post("/api/v1/ide/databases/{database_id}/start")
async def start_database(
    database_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Start database container"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        database = await conn.fetchrow(
            "SELECT * FROM provisioned_databases WHERE id = $1 AND user_id = $2",
            database_id, uid
        )
        if not database:
            raise HTTPException(status_code=404, detail="Database not found")

        if database["status"] == "running":
            return {"message": "Database already running"}

        await conn.execute(
            "UPDATE provisioned_databases SET status = 'starting' WHERE id = $1",
            database_id
        )

        background_tasks.add_task(start_database_container, database_id)
        return {"message": "Starting database..."}

@app.post("/api/v1/ide/databases/{database_id}/stop")
async def stop_database(
    database_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Stop database container"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        database = await conn.fetchrow(
            "SELECT * FROM provisioned_databases WHERE id = $1 AND user_id = $2",
            database_id, uid
        )
        if not database:
            raise HTTPException(status_code=404, detail="Database not found")

        await conn.execute(
            "UPDATE provisioned_databases SET status = 'stopping' WHERE id = $1",
            database_id
        )

        background_tasks.add_task(stop_database_container, database_id)
        return {"message": "Stopping database..."}

@app.delete("/api/v1/ide/databases/{database_id}")
async def delete_database(
    database_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Delete a database"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        database = await conn.fetchrow(
            "SELECT * FROM provisioned_databases WHERE id = $1 AND user_id = $2",
            database_id, uid
        )
        if not database:
            raise HTTPException(status_code=404, detail="Database not found")

        await conn.execute(
            "UPDATE provisioned_databases SET status = 'deleted' WHERE id = $1",
            database_id
        )

        if database["container_id"]:
            background_tasks.add_task(delete_database_container, database_id)

        return {"message": "Database deleted"}

# ══════════════════════════════════════════════════════════════════════════════
# GITHUB INTEGRATION
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/ide/git/connections")
async def list_git_connections(
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """List connected Git accounts"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        connections = await conn.fetch("""
            SELECT id, provider, provider_username, provider_email,
                   provider_avatar_url, scopes, is_active, last_sync_at, created_at
            FROM git_connections WHERE user_id = $1
        """, uid)
        return {"connections": [dict(c) for c in connections]}

@app.get("/api/v1/ide/git/auth-url")
async def get_github_auth_url(
    provider: GitProvider = GitProvider.github,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Get OAuth URL for connecting GitHub"""
    uid = get_user_id(user_id, x_user_id)

    if provider == GitProvider.github:
        if not GITHUB_CLIENT_ID:
            raise HTTPException(status_code=400, detail="GitHub OAuth not configured")

        state = secrets.token_urlsafe(32)
        # Store state for validation (in production, use Redis)

        auth_url = (
            f"https://github.com/login/oauth/authorize"
            f"?client_id={GITHUB_CLIENT_ID}"
            f"&redirect_uri=https://aicaffe.ai/api/v1/ide/git/callback"
            f"&scope=repo,read:user,user:email"
            f"&state={state}"
        )
        return {"auth_url": auth_url, "state": state}

    raise HTTPException(status_code=400, detail=f"Provider {provider} not supported yet")

@app.post("/api/v1/ide/git/connect/github")
async def connect_github(
    data: GitHubConnect,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Connect GitHub account using OAuth code"""
    uid = get_user_id(user_id, x_user_id)

    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="GitHub OAuth not configured")

    # Exchange code for token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": data.code
            },
            headers={"Accept": "application/json"}
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code for token")

        token_data = token_response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            raise HTTPException(status_code=400, detail="No access token received")

        # Get user info
        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {access_token}"}
        )
        github_user = user_response.json()

        # Get user email
        email_response = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"token {access_token}"}
        )
        emails = email_response.json()
        primary_email = next((e["email"] for e in emails if e["primary"]), None)

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Upsert connection
        connection_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO git_connections (
                id, user_id, provider, provider_user_id, provider_username,
                provider_email, provider_avatar_url, access_token_encrypted, scopes
            ) VALUES ($1, $2, 'github', $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id, provider) DO UPDATE SET
                provider_user_id = EXCLUDED.provider_user_id,
                provider_username = EXCLUDED.provider_username,
                provider_email = EXCLUDED.provider_email,
                provider_avatar_url = EXCLUDED.provider_avatar_url,
                access_token_encrypted = EXCLUDED.access_token_encrypted,
                is_active = TRUE,
                updated_at = NOW()
        """, connection_id, uid, str(github_user["id"]), github_user["login"],
            primary_email, github_user.get("avatar_url"),
            encrypt_value(access_token), ["repo", "read:user", "user:email"]
        )

        return {
            "message": "GitHub connected successfully",
            "username": github_user["login"],
            "email": primary_email
        }

@app.get("/api/v1/ide/git/repos")
async def list_git_repos(
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
    provider: GitProvider = GitProvider.github,
    refresh: bool = False,
):
    """List repositories from connected Git account"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()

    async with pool.acquire() as conn:
        connection = await conn.fetchrow("""
            SELECT * FROM git_connections
            WHERE user_id = $1 AND provider = $2 AND is_active = TRUE
        """, uid, provider.value)

        if not connection:
            raise HTTPException(status_code=400, detail=f"No {provider} connection found")

        # Check if we need to refresh
        should_refresh = refresh or not connection["last_sync_at"] or \
            (datetime.now(connection["last_sync_at"].tzinfo) - connection["last_sync_at"]).seconds > 300

        if should_refresh:
            # Fetch from GitHub
            access_token = decrypt_value(connection["access_token_encrypted"])
            async with httpx.AsyncClient() as client:
                repos_response = await client.get(
                    "https://api.github.com/user/repos?per_page=100&sort=updated",
                    headers={"Authorization": f"token {access_token}"}
                )

                if repos_response.status_code == 200:
                    repos = repos_response.json()

                    # Update database
                    for repo in repos:
                        await conn.execute("""
                            INSERT INTO git_repositories (
                                id, connection_id, user_id, provider_repo_id, name,
                                full_name, description, url, clone_url, ssh_url,
                                default_branch, is_private, is_fork, language,
                                stars_count, forks_count, last_push_at, synced_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
                            ON CONFLICT (connection_id, provider_repo_id) DO UPDATE SET
                                name = EXCLUDED.name,
                                description = EXCLUDED.description,
                                default_branch = EXCLUDED.default_branch,
                                stars_count = EXCLUDED.stars_count,
                                forks_count = EXCLUDED.forks_count,
                                last_push_at = EXCLUDED.last_push_at,
                                synced_at = NOW()
                        """, str(uuid.uuid4()), connection["id"], uid, str(repo["id"]),
                            repo["name"], repo["full_name"], repo.get("description"),
                            repo["html_url"], repo["clone_url"], repo["ssh_url"],
                            repo.get("default_branch", "main"), repo["private"],
                            repo["fork"], repo.get("language"),
                            repo["stargazers_count"], repo["forks_count"],
                            repo.get("pushed_at")
                        )

                    # Update sync time
                    await conn.execute(
                        "UPDATE git_connections SET last_sync_at = NOW() WHERE id = $1",
                        connection["id"]
                    )

        # Return cached repos
        repos = await conn.fetch("""
            SELECT * FROM git_repositories
            WHERE connection_id = $1
            ORDER BY last_push_at DESC NULLS LAST
        """, connection["id"])

        return {"repositories": [dict(r) for r in repos]}

@app.delete("/api/v1/ide/git/connections/{connection_id}")
async def disconnect_git(
    connection_id: str,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Disconnect a Git account"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM git_connections WHERE id = $1 AND user_id = $2",
            connection_id, uid
        )
        return {"message": "Git account disconnected"}

# ══════════════════════════════════════════════════════════════════════════════
# EXTENSIONS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/ide/extensions")
async def list_extensions(
    category: Optional[str] = None,
    search: Optional[str] = None,
    featured: bool = False,
):
    """List available VS Code extensions"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = "SELECT * FROM ide_extensions WHERE 1=1"
        params = []
        idx = 1

        if category:
            query += f" AND category = ${idx}"
            params.append(category)
            idx += 1

        if search:
            query += f" AND (name ILIKE ${idx} OR description ILIKE ${idx})"
            params.append(f"%{search}%")
            idx += 1

        if featured:
            query += " AND is_featured = TRUE"

        query += " ORDER BY is_featured DESC, download_count DESC"

        extensions = await conn.fetch(query, *params)
        return {"extensions": [dict(e) for e in extensions]}

@app.get("/api/v1/ide/extensions/user")
async def list_user_extensions(
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """List user's favorite extensions"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        extensions = await conn.fetch("""
            SELECT e.*, ue.is_favorite, ue.auto_install
            FROM user_ide_extensions ue
            JOIN ide_extensions e ON ue.extension_id = e.id
            WHERE ue.user_id = $1
        """, uid)
        return {"extensions": [dict(e) for e in extensions]}

@app.post("/api/v1/ide/extensions/{extension_id}/favorite")
async def toggle_favorite_extension(
    extension_id: str,
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
):
    """Toggle extension as favorite"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT * FROM user_ide_extensions WHERE user_id = $1 AND extension_id = $2",
            uid, extension_id
        )

        if existing:
            await conn.execute(
                "UPDATE user_ide_extensions SET is_favorite = NOT is_favorite WHERE id = $1",
                existing["id"]
            )
        else:
            await conn.execute("""
                INSERT INTO user_ide_extensions (id, user_id, extension_id, is_favorite)
                VALUES ($1, $2, $3, TRUE)
            """, str(uuid.uuid4()), uid, extension_id)

        return {"message": "Extension favorite toggled"}

# ══════════════════════════════════════════════════════════════════════════════
# BILLING & USAGE
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/ide/usage")
async def get_ide_usage(
    user_id: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
    days: int = 30,
):
    """Get IDE usage statistics"""
    uid = get_user_id(user_id, x_user_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Get total stats
        totals = await conn.fetchrow("""
            SELECT
                COUNT(DISTINCT p.id) as total_projects,
                COALESCE(SUM(p.tokens_consumed), 0) as total_tokens,
                COALESCE(SUM(p.total_runtime_minutes), 0) as total_minutes,
                COUNT(DISTINCT d.id) as total_databases
            FROM ide_projects p
            LEFT JOIN provisioned_databases d ON d.user_id = p.user_id
            WHERE p.user_id = $1 AND p.status != 'deleted'
        """, uid)

        # Get daily usage
        daily = await conn.fetch("""
            SELECT DATE(s.started_at) as date,
                   SUM(s.duration_minutes) as minutes,
                   SUM(s.tokens_charged) as tokens
            FROM ide_sessions s
            WHERE s.user_id = $1 AND s.started_at >= NOW() - INTERVAL '%s days'
            GROUP BY DATE(s.started_at)
            ORDER BY date
        """ % days, uid)

        # Active sessions
        active = await conn.fetch("""
            SELECT p.id, p.name, s.started_at, r.tokens_per_hour
            FROM ide_sessions s
            JOIN ide_projects p ON s.project_id = p.id
            JOIN ide_resource_presets r ON p.resource_preset_id = r.id
            WHERE s.user_id = $1 AND s.ended_at IS NULL
        """, uid)

        return {
            "totals": dict(totals) if totals else {},
            "daily_usage": [dict(d) for d in daily],
            "active_sessions": [dict(a) for a in active]
        }

# ══════════════════════════════════════════════════════════════════════════════
# BACKGROUND TASKS (Container Management)
# ══════════════════════════════════════════════════════════════════════════════

async def provision_ide_container(project_id: str):
    """Background task to provision IDE container"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow("""
            SELECT p.*, t.docker_image, t.startup_script, t.default_settings,
                   r.cpu_cores, r.memory_mb, r.storage_gb
            FROM ide_projects p
            LEFT JOIN ide_templates t ON p.template_id = t.id
            JOIN ide_resource_presets r ON p.resource_preset_id = r.id
            WHERE p.id = $1
        """, project_id)

        if not project:
            return

        try:
            # In production, this would use Docker SDK or Kubernetes API
            # For now, we simulate container creation
            container_id = f"ide-{project_id[:8]}"
            port = IDE_PORT_RANGE_START + hash(project_id) % (IDE_PORT_RANGE_END - IDE_PORT_RANGE_START)
            container_url = f"https://{project['slug']}.{IDE_BASE_DOMAIN}"

            # Update project with container info
            await conn.execute("""
                UPDATE ide_projects SET
                    status = 'stopped',
                    container_id = $1,
                    container_url = $2,
                    updated_at = NOW()
                WHERE id = $3
            """, container_id, container_url, project_id)

        except Exception as e:
            await conn.execute("""
                UPDATE ide_projects SET status = 'error', updated_at = NOW() WHERE id = $1
            """, project_id)

async def start_ide_container(project_id: str):
    """Background task to start IDE container"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow("SELECT * FROM ide_projects WHERE id = $1", project_id)
        if not project:
            return

        try:
            # In production, start the Docker container
            # docker.containers.get(project['container_id']).start()

            # Create session
            session_id = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO ide_sessions (id, project_id, user_id, resource_preset_id)
                VALUES ($1, $2, $3, $4)
            """, session_id, project_id, project["user_id"], project["resource_preset_id"])

            await conn.execute("""
                UPDATE ide_projects SET
                    status = 'running',
                    last_accessed_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
            """, project_id)

        except Exception as e:
            await conn.execute(
                "UPDATE ide_projects SET status = 'error' WHERE id = $1", project_id
            )

async def stop_ide_container(project_id: str):
    """Background task to stop IDE container"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow("SELECT * FROM ide_projects WHERE id = $1", project_id)
        if not project:
            return

        try:
            # In production, stop the Docker container

            # End session and calculate billing
            session = await conn.fetchrow("""
                SELECT * FROM ide_sessions
                WHERE project_id = $1 AND ended_at IS NULL
                ORDER BY started_at DESC LIMIT 1
            """, project_id)

            if session:
                duration = int((datetime.now() - session["started_at"].replace(tzinfo=None)).total_seconds() / 60)
                preset = await conn.fetchrow(
                    "SELECT tokens_per_hour FROM ide_resource_presets WHERE id = $1",
                    session["resource_preset_id"]
                )
                tokens = int((duration / 60) * preset["tokens_per_hour"]) if preset else 0

                await conn.execute("""
                    UPDATE ide_sessions SET
                        ended_at = NOW(),
                        duration_minutes = $1,
                        tokens_charged = $2,
                        billing_status = 'charged'
                    WHERE id = $3
                """, duration, tokens, session["id"])

                # Update project totals
                await conn.execute("""
                    UPDATE ide_projects SET
                        tokens_consumed = tokens_consumed + $1,
                        total_runtime_minutes = total_runtime_minutes + $2
                    WHERE id = $3
                """, tokens, duration, project_id)

            await conn.execute(
                "UPDATE ide_projects SET status = 'stopped', updated_at = NOW() WHERE id = $1",
                project_id
            )

        except Exception as e:
            await conn.execute(
                "UPDATE ide_projects SET status = 'error' WHERE id = $1", project_id
            )

async def provision_database_container(database_id: str):
    """Background task to provision database container"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        database = await conn.fetchrow("""
            SELECT d.*, dt.docker_image, dt.default_port
            FROM provisioned_databases d
            JOIN database_types dt ON d.database_type_id = dt.id
            WHERE d.id = $1
        """, database_id)

        if not database:
            return

        try:
            # In production, create Docker container
            container_id = f"db-{database_id[:8]}"
            port = 15432 + hash(database_id) % 1000  # Allocate port

            await conn.execute("""
                UPDATE provisioned_databases SET
                    status = 'stopped',
                    container_id = $1,
                    host = 'localhost',
                    port = $2,
                    updated_at = NOW()
                WHERE id = $3
            """, container_id, port, database_id)

        except Exception as e:
            await conn.execute(
                "UPDATE provisioned_databases SET status = 'error' WHERE id = $1",
                database_id
            )

async def start_database_container(database_id: str):
    """Start database container"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE provisioned_databases SET status = 'running', updated_at = NOW() WHERE id = $1",
            database_id
        )

async def stop_database_container(database_id: str):
    """Stop database container"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE provisioned_databases SET status = 'stopped', updated_at = NOW() WHERE id = $1",
            database_id
        )

async def delete_database_container(database_id: str):
    """Delete database container"""
    # In production, remove Docker container and volume
    pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)
