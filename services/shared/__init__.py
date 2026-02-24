"""
AICaffe Shared Services Module
Common utilities, configuration, and database management for all microservices
"""
from .config import (
    get_db_settings,
    get_jwt_settings,
    get_security_settings,
    get_logging_settings,
    get_redis_settings,
    get_service_settings,
    get_stripe_settings,
    get_ai_settings,
    get_app_settings,
    setup_logging,
    validate_production_config,
)
from .database import (
    db,
    DatabasePool,
    get_db,
    get_connection,
    init_database,
    close_database,
)

__all__ = [
    # Config
    "get_db_settings",
    "get_jwt_settings",
    "get_security_settings",
    "get_logging_settings",
    "get_redis_settings",
    "get_service_settings",
    "get_stripe_settings",
    "get_ai_settings",
    "get_app_settings",
    "setup_logging",
    "validate_production_config",
    # Database
    "db",
    "DatabasePool",
    "get_db",
    "get_connection",
    "init_database",
    "close_database",
]
