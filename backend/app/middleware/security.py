"""
Security Middleware
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import structlog
import time

logger = structlog.get_logger()


class SecurityMiddleware(BaseHTTPMiddleware):
    """Security middleware for additional security headers"""
    
    async def dispatch(self, request: Request, call_next):
        # Add security headers
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response
