"""
Logging Middleware
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import structlog
import time
import uuid

logger = structlog.get_logger()


class LoggingMiddleware(BaseHTTPMiddleware):
    """Logging middleware for request/response logging"""
    
    async def dispatch(self, request: Request, call_next):
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # Log request
        start_time = time.time()
        logger.info(
            "Request started",
            request_id=request_id,
            method=request.method,
            url=str(request.url),
            user_agent=request.headers.get("user-agent")
        )
        
        # Process request
        response = await call_next(request)
        
        # Log response
        duration = time.time() - start_time
        logger.info(
            "Request completed",
            request_id=request_id,
            status_code=response.status_code,
            duration=f"{duration:.3f}s"
        )
        
        return response
