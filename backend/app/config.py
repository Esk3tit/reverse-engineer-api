"""
Configuration settings for the FastAPI application
"""
from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""
    
    # App settings
    APP_NAME: str = "HAR Reverse Engineering API"
    DEBUG: bool = False
    VERSION: str = "1.0.0"
    
    # CORS settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",  # Next.js dev server
        "http://127.0.0.1:3000",
        "https://your-frontend-domain.com"  # Add your production domain
    ]
    
    # LLM settings
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-2024-08-06"
    OPENAI_MAX_TOKENS: int = 4096
    OPENAI_TEMPERATURE: float = 0.1
    
    # File processing settings
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    MAX_REQUESTS_TO_ANALYZE: int = 50  # Limit for token efficiency
    
    # Request filtering settings
    EXCLUDE_MIME_TYPES: List[str] = [
        "text/html",
        "text/css", 
        "application/javascript",
        "text/javascript",
        "image/",
        "font/",
        "audio/",
        "video/"
    ]
    
    INCLUDE_STATUS_CODES: List[int] = [200, 201, 202, 204, 206]
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings"""
    return Settings()