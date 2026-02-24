"""
AICaffe Auth Service - Authentication, registration, and user management
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
import jwt
import bcrypt
import os
import asyncpg

app = FastAPI(title="AICaffe Auth Service", version="1.0.0")
security = HTTPBearer(auto_error=False)

JWT_SECRET = os.getenv("JWT_SECRET", "aicaffe-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

# ── Schemas ────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)
    organization_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    organization_id: Optional[str]
    is_verified: bool
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[dict] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

class APIKeyCreate(BaseModel):
    name: str
    scopes: List[str] = ["read"]
    expires_in_days: Optional[int] = 365

# ── Database Interface (async with asyncpg) ────────────────────────

# Singleton connection pool

class Database:
    """Database interface - connect to PostgreSQL via asyncpg"""
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

# ── Auth Helpers ───────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_data: dict) -> str:
    payload = {
        "sub": user_data["id"],
        "email": user_data["email"],
        "role": user_data["role"],
        "org_id": user_data.get("organization_id"),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── Routes ─────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "auth"}

@app.post("/api/v1/auth/register", response_model=TokenResponse, status_code=201)
async def register(data: UserRegister):
    """Register a new user and create token wallet"""
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        # Check existing
        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", data.email)
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        user_id = str(uuid.uuid4())
        org_id = None

        # Create organization if provided
        if data.organization_name:
            org_id = str(uuid.uuid4())
            slug = data.organization_name.lower().replace(" ", "-")
            await conn.execute(
                "INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)",
                org_id, data.organization_name, slug
            )

        # Create user
        password_hash = hash_password(data.password)
        await conn.execute(
            """INSERT INTO users (id, email, password_hash, full_name, organization_id, role)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            user_id, data.email, password_hash, data.full_name, org_id, "user"
        )

        # Create token wallet with 10,000 free starter tokens
        wallet_id = str(uuid.uuid4())
        await conn.execute(
            """INSERT INTO token_wallets (id, user_id, balance, total_purchased)
               VALUES ($1, $2, 10000, 10000)""",
            wallet_id, user_id
        )

        user = {
            "id": user_id,
            "email": data.email,
            "full_name": data.full_name,
            "role": "user",
            "organization_id": org_id,
            "is_verified": False,
            "created_at": datetime.utcnow(),
        }

        token = create_token(user)
        return TokenResponse(
            access_token=token,
            expires_in=JWT_EXPIRY_HOURS * 3600,
            user=UserResponse(**user)
        )

@app.post("/api/v1/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    """Authenticate user and return JWT"""
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT * FROM users WHERE email = $1 AND is_active = TRUE", data.email
        )
        if not user or not verify_password(data.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Update last login
        await conn.execute(
            "UPDATE users SET last_login_at = NOW() WHERE id = $1", user["id"]
        )

        user_data = {
            "id": str(user["id"]),
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "organization_id": str(user["organization_id"]) if user["organization_id"] else None,
            "is_verified": user["is_verified"],
            "created_at": user["created_at"],
        }

        token = create_token(user_data)
        return TokenResponse(
            access_token=token,
            expires_in=JWT_EXPIRY_HOURS * 3600,
            user=UserResponse(**user_data)
        )

@app.get("/api/v1/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", current_user["sub"])
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse(
            id=str(user["id"]),
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            organization_id=str(user["organization_id"]) if user["organization_id"] else None,
            is_verified=user["is_verified"],
            created_at=user["created_at"],
        )

@app.put("/api/v1/auth/me")
async def update_profile(data: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update user profile"""
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        updates = []
        params = []
        idx = 1
        if data.full_name:
            updates.append(f"full_name = ${idx}")
            params.append(data.full_name)
            idx += 1
        if data.avatar_url:
            updates.append(f"avatar_url = ${idx}")
            params.append(data.avatar_url)
            idx += 1
        if data.preferences:
            updates.append(f"preferences = ${idx}")
            params.append(str(data.preferences))
            idx += 1

        if updates:
            params.append(current_user["sub"])
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = ${idx}"
            await conn.execute(query, *params)

        return {"message": "Profile updated"}

@app.post("/api/v1/auth/change-password")
async def change_password(data: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change user password"""
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT password_hash FROM users WHERE id = $1", current_user["sub"])
        if not verify_password(data.current_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        new_hash = hash_password(data.new_password)
        await conn.execute("UPDATE users SET password_hash = $1 WHERE id = $2", new_hash, current_user["sub"])
        return {"message": "Password changed successfully"}

@app.post("/api/v1/auth/api-keys")
async def create_api_key(data: APIKeyCreate, current_user: dict = Depends(get_current_user)):
    """Generate a new API key for programmatic access"""
    raw_key = f"aic_{uuid.uuid4().hex}"
    key_hash = hash_password(raw_key)
    key_prefix = raw_key[:8]

    pool = await db.get_pool()
    async with pool.acquire() as conn:
        key_id = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(days=data.expires_in_days) if data.expires_in_days else None
        await conn.execute(
            """INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, scopes, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            key_id, current_user["sub"], key_hash, key_prefix, data.name,
            str(data.scopes), expires_at
        )

    return {
        "id": key_id,
        "key": raw_key,
        "prefix": key_prefix,
        "name": data.name,
        "scopes": data.scopes,
        "message": "Save this key securely. It won't be shown again."
    }

@app.get("/api/v1/auth/api-keys")
async def list_api_keys(current_user: dict = Depends(get_current_user)):
    """List all API keys for current user"""
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        keys = await conn.fetch(
            """SELECT id, key_prefix, name, scopes, is_active, last_used_at, expires_at, created_at
               FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC""",
            current_user["sub"]
        )
        return {"api_keys": [dict(k) for k in keys]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
