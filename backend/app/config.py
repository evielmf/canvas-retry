"""
Application Configuration Settings
"""

from pydantic import Field
from pydantic_settings import BaseSettings
from typing import List
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    # Database
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    SUPABASE_URL: str = Field(..., env="SUPABASE_URL")
    SUPABASE_ANON_KEY: str = Field(..., env="SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_KEY: str = Field(..., env="SUPABASE_SERVICE_KEY")
    
    # Security
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ALGORITHM: str = Field(default="HS256", env="ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    
    # Canvas API
    CANVAS_ENCRYPTION_KEY: str = Field(..., env="CANVAS_ENCRYPTION_KEY")
    MAX_CONCURRENT_REQUESTS: int = Field(default=10, env="MAX_CONCURRENT_REQUESTS")
    REQUEST_TIMEOUT: int = Field(default=30, env="REQUEST_TIMEOUT")
    RETRY_ATTEMPTS: int = Field(default=3, env="RETRY_ATTEMPTS")
    
    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379", env="REDIS_URL")
    
    # Logging
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FORMAT: str = Field(default="json", env="LOG_FORMAT")
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = Field(default=60, env="RATE_LIMIT_PER_MINUTE")
    
    # Environment
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    
    # CORS
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "https://localhost:3000"],
        env="ALLOWED_ORIGINS"
    )
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
