"""
AICaffe Shared Configuration Module
Production-ready configuration management for all microservices
"""
import os
import logging
import sys
from functools import lru_cache
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field


class DatabaseSettings(BaseSettings):
    """Database configuration"""
    host: str = Field(default="localhost", alias="DB_HOST")
    port: int = Field(default=5432, alias="DB_PORT")
    user: str = Field(default="postgres", alias="DB_USER")
    password: str = Field(default="postgres", alias="DB_PASSWORD")
    name: str = Field(default="aicaffe", alias="DB_NAME")

    # Connection pool settings
    pool_min_size: int = Field(default=2, alias="DB_POOL_MIN")
    pool_max_size: int = Field(default=20, alias="DB_POOL_MAX")
    pool_timeout: int = Field(default=30, alias="DB_POOL_TIMEOUT")

    @property
    def dsn(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"

    class Config:
        env_file = ".env"
        extra = "ignore"


class JWTSettings(BaseSettings):
    """JWT Authentication settings"""
    secret: str = Field(default="CHANGE_THIS_IN_PRODUCTION", alias="JWT_SECRET")
    algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    expiry_hours: int = Field(default=24, alias="JWT_EXPIRY_HOURS")

    class Config:
        env_file = ".env"
        extra = "ignore"


class SecuritySettings(BaseSettings):
    """Security configuration"""
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:4001",
        alias="CORS_ORIGINS"
    )
    rate_limit_requests: int = Field(default=100, alias="RATE_LIMIT_REQUESTS")
    rate_limit_window: int = Field(default=60, alias="RATE_LIMIT_WINDOW")

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


class LoggingSettings(BaseSettings):
    """Logging configuration"""
    level: str = Field(default="INFO", alias="LOG_LEVEL")
    format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        alias="LOG_FORMAT"
    )

    class Config:
        env_file = ".env"
        extra = "ignore"


class RedisSettings(BaseSettings):
    """Redis configuration"""
    url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")

    class Config:
        env_file = ".env"
        extra = "ignore"


class ServiceSettings(BaseSettings):
    """Service URLs for inter-service communication"""
    auth_url: str = Field(default="http://localhost:8001", alias="AUTH_SERVICE_URL")
    models_url: str = Field(default="http://localhost:8002", alias="MODEL_REGISTRY_URL")
    tokens_url: str = Field(default="http://localhost:8003", alias="TOKEN_SERVICE_URL")
    recommendations_url: str = Field(default="http://localhost:8004", alias="RECOMMENDATION_URL")
    news_url: str = Field(default="http://localhost:8005", alias="NEWS_SERVICE_URL")
    ai_proxy_url: str = Field(default="http://localhost:8006", alias="AI_PROXY_URL")
    billing_url: str = Field(default="http://localhost:8007", alias="BILLING_SERVICE_URL")
    storage_url: str = Field(default="http://localhost:8008", alias="STORAGE_SERVICE_URL")
    workspace_url: str = Field(default="http://localhost:8009", alias="WORKSPACE_SERVICE_URL")
    orchestrator_url: str = Field(default="http://localhost:8010", alias="ORCHESTRATOR_SERVICE_URL")
    ide_url: str = Field(default="http://localhost:8011", alias="CLOUD_IDE_SERVICE_URL")

    class Config:
        env_file = ".env"
        extra = "ignore"


class StripeSettings(BaseSettings):
    """Stripe payment configuration"""
    secret_key: str = Field(default="", alias="STRIPE_SECRET_KEY")
    publishable_key: str = Field(default="", alias="STRIPE_PUBLISHABLE_KEY")
    webhook_secret: str = Field(default="", alias="STRIPE_WEBHOOK_SECRET")

    class Config:
        env_file = ".env"
        extra = "ignore"


class AIProviderSettings(BaseSettings):
    """AI Provider API keys"""
    openai_key: str = Field(default="", alias="OPENAI_API_KEY")
    anthropic_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    google_key: str = Field(default="", alias="GOOGLE_API_KEY")
    mistral_key: str = Field(default="", alias="MISTRAL_API_KEY")
    groq_key: str = Field(default="", alias="GROQ_API_KEY")
    together_key: str = Field(default="", alias="TOGETHER_API_KEY")
    deepseek_key: str = Field(default="", alias="DEEPSEEK_API_KEY")
    perplexity_key: str = Field(default="", alias="PERPLEXITY_API_KEY")
    replicate_key: str = Field(default="", alias="REPLICATE_API_TOKEN")
    stability_key: str = Field(default="", alias="STABILITY_API_KEY")
    elevenlabs_key: str = Field(default="", alias="ELEVENLABS_API_KEY")

    class Config:
        env_file = ".env"
        extra = "ignore"


class AppSettings(BaseSettings):
    """Main application settings"""
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=False, alias="DEBUG")
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")

    # Token economics
    token_usd_rate: float = Field(default=0.00005, alias="TOKEN_USD_RATE")
    platform_margin: float = Field(default=0.20, alias="PLATFORM_MARGIN")

    class Config:
        env_file = ".env"
        extra = "ignore"


# Cached settings instances
@lru_cache()
def get_db_settings() -> DatabaseSettings:
    return DatabaseSettings()

@lru_cache()
def get_jwt_settings() -> JWTSettings:
    return JWTSettings()

@lru_cache()
def get_security_settings() -> SecuritySettings:
    return SecuritySettings()

@lru_cache()
def get_logging_settings() -> LoggingSettings:
    return LoggingSettings()

@lru_cache()
def get_redis_settings() -> RedisSettings:
    return RedisSettings()

@lru_cache()
def get_service_settings() -> ServiceSettings:
    return ServiceSettings()

@lru_cache()
def get_stripe_settings() -> StripeSettings:
    return StripeSettings()

@lru_cache()
def get_ai_settings() -> AIProviderSettings:
    return AIProviderSettings()

@lru_cache()
def get_app_settings() -> AppSettings:
    return AppSettings()


def setup_logging(service_name: str) -> logging.Logger:
    """Setup structured logging for a service"""
    settings = get_logging_settings()

    # Create logger
    logger = logging.getLogger(service_name)
    logger.setLevel(getattr(logging, settings.level.upper()))

    # Console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(getattr(logging, settings.level.upper()))

    # Formatter
    formatter = logging.Formatter(
        f"%(asctime)s - {service_name} - %(levelname)s - %(message)s"
    )
    handler.setFormatter(formatter)

    # Add handler
    if not logger.handlers:
        logger.addHandler(handler)

    return logger


def validate_production_config():
    """Validate that production-critical settings are properly configured"""
    jwt = get_jwt_settings()
    app = get_app_settings()

    issues = []

    # Check JWT secret
    if jwt.secret in ["CHANGE_THIS_IN_PRODUCTION", "aicaffe-secret-key-change-in-production"]:
        issues.append("JWT_SECRET is using a default/insecure value")

    if len(jwt.secret) < 32:
        issues.append("JWT_SECRET should be at least 32 characters")

    # Check environment
    if app.environment == "production":
        if app.debug:
            issues.append("DEBUG should be False in production")

        security = get_security_settings()
        if "localhost" in security.cors_origins:
            issues.append("CORS_ORIGINS should not contain localhost in production")

    return issues
