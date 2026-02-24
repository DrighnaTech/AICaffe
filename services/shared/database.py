"""
AICaffe Shared Database Module
Production-ready PostgreSQL connection management with asyncpg
"""
import asyncpg
import logging
from contextlib import asynccontextmanager
from typing import Optional, AsyncGenerator
import os

logger = logging.getLogger(__name__)


class DatabasePool:
    """
    Singleton database connection pool manager.
    Provides production-ready connection pooling with proper error handling.
    """
    _instance: Optional['DatabasePool'] = None
    _pool: Optional[asyncpg.Pool] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def pool(self) -> Optional[asyncpg.Pool]:
        return self._pool

    async def init_pool(
        self,
        host: str = None,
        port: int = None,
        user: str = None,
        password: str = None,
        database: str = None,
        min_size: int = 2,
        max_size: int = 20,
        command_timeout: float = 60.0,
        max_inactive_connection_lifetime: float = 300.0,
    ) -> asyncpg.Pool:
        """Initialize the connection pool with production settings"""
        if self._pool is not None:
            return self._pool

        # Use environment variables as defaults
        host = host or os.getenv("DB_HOST", "localhost")
        port = port or int(os.getenv("DB_PORT", "5432"))
        user = user or os.getenv("DB_USER", "postgres")
        password = password or os.getenv("DB_PASSWORD", "postgres")
        database = database or os.getenv("DB_NAME", "aicaffe")
        min_size = int(os.getenv("DB_POOL_MIN", str(min_size)))
        max_size = int(os.getenv("DB_POOL_MAX", str(max_size)))

        try:
            self._pool = await asyncpg.create_pool(
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
                min_size=min_size,
                max_size=max_size,
                command_timeout=command_timeout,
                max_inactive_connection_lifetime=max_inactive_connection_lifetime,
            )
            logger.info(f"Database pool initialized: {host}:{port}/{database} (pool: {min_size}-{max_size})")
            return self._pool
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            raise

    async def close_pool(self):
        """Close the connection pool gracefully"""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Database pool closed")

    async def get_pool(self) -> asyncpg.Pool:
        """Get or create the connection pool"""
        if self._pool is None:
            await self.init_pool()
        return self._pool

    @asynccontextmanager
    async def acquire(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """Acquire a connection from the pool with automatic release"""
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            yield conn

    async def execute(self, query: str, *args, timeout: float = None):
        """Execute a query without returning results"""
        async with self.acquire() as conn:
            return await conn.execute(query, *args, timeout=timeout)

    async def fetch(self, query: str, *args, timeout: float = None):
        """Execute a query and return all results"""
        async with self.acquire() as conn:
            return await conn.fetch(query, *args, timeout=timeout)

    async def fetchrow(self, query: str, *args, timeout: float = None):
        """Execute a query and return the first result"""
        async with self.acquire() as conn:
            return await conn.fetchrow(query, *args, timeout=timeout)

    async def fetchval(self, query: str, *args, column: int = 0, timeout: float = None):
        """Execute a query and return a single value"""
        async with self.acquire() as conn:
            return await conn.fetchval(query, *args, column=column, timeout=timeout)


# Global database instance
db = DatabasePool()


# Convenience functions for FastAPI dependency injection
async def get_db() -> DatabasePool:
    """FastAPI dependency for database access"""
    return db


async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """FastAPI dependency for direct connection access"""
    async with db.acquire() as conn:
        yield conn


# Lifecycle management for FastAPI
async def init_database():
    """Initialize database pool - call in FastAPI lifespan startup"""
    await db.init_pool()


async def close_database():
    """Close database pool - call in FastAPI lifespan shutdown"""
    await db.close_pool()
