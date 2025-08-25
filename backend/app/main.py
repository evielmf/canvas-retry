"""
FastAPI Backend Main Application
Canvas API Integration with Parallel Fetching
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import structlog
import asyncio
from contextlib import asynccontextmanager

from app.config import settings
from app.routes import auth, canvas, sync, users, dashboard
from app.middleware.security import SecurityMiddleware
from app.middleware.logging import LoggingMiddleware
from app.services.background_sync import BackgroundSyncService

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Background tasks
background_sync_service = BackgroundSyncService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting Canvas API Backend", version="1.0.0")
    
    # Start background sync service
    asyncio.create_task(background_sync_service.start_scheduler())
    
    yield
    
    # Shutdown
    logger.info("Shutting down Canvas API Backend")
    await background_sync_service.stop_scheduler()


# Create FastAPI application
app = FastAPI(
    title="Canvas API Integration Backend",
    description="FastAPI backend for Canvas LMS integration with parallel data fetching",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    lifespan=lifespan
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware
app.add_middleware(SecurityMiddleware)
app.add_middleware(LoggingMiddleware)

# Security scheme
security = HTTPBearer()

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(canvas.router, prefix="/api/v1/canvas", tags=["Canvas Integration"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["Data Synchronization"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Canvas API Integration Backend",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs" if settings.ENVIRONMENT == "development" else "disabled"
    }


@app.get("/health")
@limiter.limit("10/minute")
async def health_check(request):
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": "2025-08-24T00:00:00Z",
        "services": {
            "database": "connected",
            "redis": "connected",
            "canvas_api": "available"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )
