"""
AICaffe Storage Service (CaffeSpace) - Cloud storage for AI assets
Handles file uploads, downloads, and management for user workspaces
"""
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
import os
import shutil
import hashlib
from pathlib import Path

app = FastAPI(
    title="AICaffe Storage Service",
    description="CaffeSpace - Cloud storage for AI assets and files",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage configuration
STORAGE_ROOT = os.getenv("STORAGE_ROOT", "/tmp/aicaffe-storage")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 100 * 1024 * 1024))  # 100MB default
ALLOWED_EXTENSIONS = {
    "documents": [".pdf", ".doc", ".docx", ".txt", ".md", ".csv", ".json", ".xml"],
    "images": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"],
    "audio": [".mp3", ".wav", ".ogg", ".m4a", ".flac"],
    "video": [".mp4", ".mov", ".avi", ".webm", ".mkv"],
    "code": [".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".sql"],
    "data": [".csv", ".json", ".xml", ".parquet", ".xlsx", ".xls"],
    "models": [".pt", ".pth", ".onnx", ".h5", ".pkl", ".joblib", ".safetensors"],
}

# In-memory storage (replace with database in production)
files_db = {}
folders_db = {}

# Ensure storage directory exists
Path(STORAGE_ROOT).mkdir(parents=True, exist_ok=True)

# ── Models ─────────────────────────────────────────────────────────

class FileMetadata(BaseModel):
    id: str
    name: str
    original_name: str
    size: int
    mime_type: str
    category: str
    extension: str
    path: str
    folder_id: Optional[str] = None
    user_id: str
    checksum: str
    created_at: datetime
    updated_at: datetime
    is_public: bool = False
    tags: List[str] = []
    metadata: dict = {}

class Folder(BaseModel):
    id: str
    name: str
    parent_id: Optional[str] = None
    user_id: str
    created_at: datetime
    updated_at: datetime
    file_count: int = 0
    total_size: int = 0

class StorageStats(BaseModel):
    total_files: int
    total_size: int
    used_quota: int
    quota_limit: int
    files_by_category: dict

# ── Helpers ────────────────────────────────────────────────────────

def get_user_id(x_user_id: Optional[str] = Header(None)) -> str:
    """Extract user_id from header (injected by API Gateway)"""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    return x_user_id

def get_file_category(extension: str) -> str:
    """Determine file category based on extension"""
    ext = extension.lower()
    for category, extensions in ALLOWED_EXTENSIONS.items():
        if ext in extensions:
            return category
    return "other"

def calculate_checksum(file_path: str) -> str:
    """Calculate MD5 checksum of a file"""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def get_user_storage_path(user_id: str) -> Path:
    """Get the storage path for a user"""
    path = Path(STORAGE_ROOT) / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path

def get_user_files(user_id: str) -> List[FileMetadata]:
    """Get all files for a user"""
    return [f for f in files_db.values() if f["user_id"] == user_id]

def get_user_storage_stats(user_id: str) -> dict:
    """Calculate storage stats for a user"""
    user_files = get_user_files(user_id)
    total_size = sum(f["size"] for f in user_files)
    by_category = {}
    for f in user_files:
        cat = f.get("category", "other")
        if cat not in by_category:
            by_category[cat] = {"count": 0, "size": 0}
        by_category[cat]["count"] += 1
        by_category[cat]["size"] += f["size"]

    return {
        "total_files": len(user_files),
        "total_size": total_size,
        "used_quota": total_size,
        "quota_limit": 5 * 1024 * 1024 * 1024,  # 5GB default
        "files_by_category": by_category
    }

# ── Health ─────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "storage"}

@app.get("/")
async def root():
    return {
        "service": "CaffeSpace Storage",
        "version": "1.0.0",
        "description": "Cloud storage for AI assets and files"
    }

# ── File Operations ────────────────────────────────────────────────

@app.post("/api/v1/storage/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    is_public: bool = Form(False),
    x_user_id: Optional[str] = Header(None)
):
    """Upload a file to storage"""
    user_id = get_user_id(x_user_id)

    # Validate file size
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024}MB")

    # Get file info
    original_name = file.filename or "unnamed"
    extension = Path(original_name).suffix.lower()
    category = get_file_category(extension)

    # Generate unique filename
    file_id = str(uuid.uuid4())
    safe_name = f"{file_id}{extension}"

    # Save file
    user_path = get_user_storage_path(user_id)
    file_path = user_path / safe_name

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Calculate checksum
    checksum = calculate_checksum(str(file_path))

    # Parse tags
    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]

    # Create metadata
    now = datetime.utcnow()
    file_metadata = {
        "id": file_id,
        "name": safe_name,
        "original_name": original_name,
        "size": size,
        "mime_type": file.content_type or "application/octet-stream",
        "category": category,
        "extension": extension,
        "path": str(file_path),
        "folder_id": folder_id,
        "user_id": user_id,
        "checksum": checksum,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "is_public": is_public,
        "tags": tag_list,
        "metadata": {}
    }

    files_db[file_id] = file_metadata

    return {
        "success": True,
        "file": file_metadata,
        "message": f"File '{original_name}' uploaded successfully"
    }

@app.get("/api/v1/storage/files")
async def list_files(
    folder_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=100),
    offset: int = 0,
    x_user_id: Optional[str] = Header(None)
):
    """List files for the current user"""
    user_id = get_user_id(x_user_id)

    user_files = get_user_files(user_id)

    # Filter by folder
    if folder_id:
        user_files = [f for f in user_files if f.get("folder_id") == folder_id]

    # Filter by category
    if category:
        user_files = [f for f in user_files if f.get("category") == category]

    # Search by name
    if search:
        search_lower = search.lower()
        user_files = [f for f in user_files if search_lower in f.get("original_name", "").lower()]

    # Sort by created_at descending
    user_files.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    # Paginate
    total = len(user_files)
    files = user_files[offset:offset + limit]

    return {
        "files": files,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.get("/api/v1/storage/files/{file_id}")
async def get_file(
    file_id: str,
    x_user_id: Optional[str] = Header(None)
):
    """Get file metadata"""
    user_id = get_user_id(x_user_id)

    file_meta = files_db.get(file_id)
    if not file_meta:
        raise HTTPException(status_code=404, detail="File not found")

    # Check ownership or public access
    if file_meta["user_id"] != user_id and not file_meta.get("is_public"):
        raise HTTPException(status_code=403, detail="Access denied")

    return {"file": file_meta}

@app.get("/api/v1/storage/download/{file_id}")
async def download_file(
    file_id: str,
    x_user_id: Optional[str] = Header(None)
):
    """Download a file"""
    user_id = get_user_id(x_user_id)

    file_meta = files_db.get(file_id)
    if not file_meta:
        raise HTTPException(status_code=404, detail="File not found")

    # Check ownership or public access
    if file_meta["user_id"] != user_id and not file_meta.get("is_public"):
        raise HTTPException(status_code=403, detail="Access denied")

    file_path = file_meta["path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        filename=file_meta["original_name"],
        media_type=file_meta["mime_type"]
    )

@app.delete("/api/v1/storage/files/{file_id}")
async def delete_file(
    file_id: str,
    x_user_id: Optional[str] = Header(None)
):
    """Delete a file"""
    user_id = get_user_id(x_user_id)

    file_meta = files_db.get(file_id)
    if not file_meta:
        raise HTTPException(status_code=404, detail="File not found")

    if file_meta["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete from disk
    try:
        os.remove(file_meta["path"])
    except FileNotFoundError:
        pass

    # Delete from database
    del files_db[file_id]

    return {"success": True, "message": "File deleted"}

@app.put("/api/v1/storage/files/{file_id}")
async def update_file(
    file_id: str,
    name: Optional[str] = None,
    tags: Optional[List[str]] = None,
    is_public: Optional[bool] = None,
    folder_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(None)
):
    """Update file metadata"""
    user_id = get_user_id(x_user_id)

    file_meta = files_db.get(file_id)
    if not file_meta:
        raise HTTPException(status_code=404, detail="File not found")

    if file_meta["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update fields
    if name is not None:
        file_meta["original_name"] = name
    if tags is not None:
        file_meta["tags"] = tags
    if is_public is not None:
        file_meta["is_public"] = is_public
    if folder_id is not None:
        file_meta["folder_id"] = folder_id

    file_meta["updated_at"] = datetime.utcnow().isoformat()
    files_db[file_id] = file_meta

    return {"file": file_meta}

# ── Folder Operations ──────────────────────────────────────────────

@app.post("/api/v1/storage/folders")
async def create_folder(
    name: str,
    parent_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(None)
):
    """Create a new folder"""
    user_id = get_user_id(x_user_id)

    folder_id = str(uuid.uuid4())
    now = datetime.utcnow()

    folder = {
        "id": folder_id,
        "name": name,
        "parent_id": parent_id,
        "user_id": user_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "file_count": 0,
        "total_size": 0
    }

    folders_db[folder_id] = folder

    return {"folder": folder}

@app.get("/api/v1/storage/folders")
async def list_folders(
    parent_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(None)
):
    """List folders for the current user"""
    user_id = get_user_id(x_user_id)

    user_folders = [f for f in folders_db.values() if f["user_id"] == user_id]

    if parent_id is not None:
        user_folders = [f for f in user_folders if f.get("parent_id") == parent_id]
    else:
        user_folders = [f for f in user_folders if f.get("parent_id") is None]

    return {"folders": user_folders}

@app.delete("/api/v1/storage/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    x_user_id: Optional[str] = Header(None)
):
    """Delete a folder and all its contents"""
    user_id = get_user_id(x_user_id)

    folder = folders_db.get(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    if folder["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete all files in folder
    files_to_delete = [f for f in files_db.values() if f.get("folder_id") == folder_id]
    for file_meta in files_to_delete:
        try:
            os.remove(file_meta["path"])
        except FileNotFoundError:
            pass
        del files_db[file_meta["id"]]

    # Delete subfolder contents recursively
    subfolders = [f for f in folders_db.values() if f.get("parent_id") == folder_id]
    for subfolder in subfolders:
        await delete_folder(subfolder["id"], x_user_id)

    # Delete folder
    del folders_db[folder_id]

    return {"success": True, "message": "Folder deleted"}

# ── Storage Stats ──────────────────────────────────────────────────

@app.get("/api/v1/storage/stats")
async def get_storage_stats(
    x_user_id: Optional[str] = Header(None)
):
    """Get storage statistics for the current user"""
    user_id = get_user_id(x_user_id)
    stats = get_user_storage_stats(user_id)
    return {"stats": stats}

@app.get("/api/v1/storage/recent")
async def get_recent_files(
    limit: int = Query(10, le=50),
    x_user_id: Optional[str] = Header(None)
):
    """Get recently uploaded files"""
    user_id = get_user_id(x_user_id)

    user_files = get_user_files(user_id)
    user_files.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return {"files": user_files[:limit]}

# ── Search & Tags ──────────────────────────────────────────────────

@app.get("/api/v1/storage/search")
async def search_files(
    q: str,
    category: Optional[str] = None,
    tags: Optional[str] = None,
    limit: int = Query(50, le=100),
    x_user_id: Optional[str] = Header(None)
):
    """Search files by name, tags, or content"""
    user_id = get_user_id(x_user_id)

    user_files = get_user_files(user_id)
    q_lower = q.lower()

    results = []
    for f in user_files:
        # Search in name
        if q_lower in f.get("original_name", "").lower():
            results.append(f)
            continue

        # Search in tags
        file_tags = [t.lower() for t in f.get("tags", [])]
        if any(q_lower in tag for tag in file_tags):
            results.append(f)
            continue

    # Filter by category
    if category:
        results = [f for f in results if f.get("category") == category]

    # Filter by tags
    if tags:
        tag_list = [t.strip().lower() for t in tags.split(",")]
        results = [f for f in results if any(t in [x.lower() for x in f.get("tags", [])] for t in tag_list)]

    return {"files": results[:limit], "total": len(results)}

@app.get("/api/v1/storage/tags")
async def get_all_tags(
    x_user_id: Optional[str] = Header(None)
):
    """Get all unique tags for the user"""
    user_id = get_user_id(x_user_id)

    user_files = get_user_files(user_id)
    all_tags = set()
    for f in user_files:
        all_tags.update(f.get("tags", []))

    return {"tags": sorted(list(all_tags))}

# ── Sharing ────────────────────────────────────────────────────────

@app.post("/api/v1/storage/share/{file_id}")
async def share_file(
    file_id: str,
    x_user_id: Optional[str] = Header(None)
):
    """Generate a public share link for a file"""
    user_id = get_user_id(x_user_id)

    file_meta = files_db.get(file_id)
    if not file_meta:
        raise HTTPException(status_code=404, detail="File not found")

    if file_meta["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Make file public
    file_meta["is_public"] = True
    file_meta["updated_at"] = datetime.utcnow().isoformat()
    files_db[file_id] = file_meta

    # Generate share URL (in production, this would be a proper URL)
    share_url = f"/api/v1/storage/public/{file_id}"

    return {
        "share_url": share_url,
        "file_id": file_id,
        "is_public": True
    }

@app.get("/api/v1/storage/public/{file_id}")
async def get_public_file(file_id: str):
    """Access a publicly shared file"""
    file_meta = files_db.get(file_id)
    if not file_meta:
        raise HTTPException(status_code=404, detail="File not found")

    if not file_meta.get("is_public"):
        raise HTTPException(status_code=403, detail="File is not public")

    file_path = file_meta["path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        filename=file_meta["original_name"],
        media_type=file_meta["mime_type"]
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)
