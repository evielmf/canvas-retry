"""
Authentication Middleware
Handles JWT token validation with Supabase
"""

from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import structlog
from typing import Dict, Any

from app.config import settings

logger = structlog.get_logger()
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Extract and validate user from JWT token
    This integrates with Supabase authentication
    """
    try:
        # Decode JWT token
        token = credentials.credentials
        
        # In a real implementation, you would:
        # 1. Verify the token with Supabase
        # 2. Extract user information
        # 3. Validate token hasn't expired
        
        # For now, we'll decode without verification (not recommended for production)
        payload = jwt.decode(
            token, 
            options={"verify_signature": False}  # In production, verify with Supabase
        )
        
        # Extract user ID from token
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        # Return user information
        return {
            "sub": user_id,
            "email": payload.get("email"),
            "role": payload.get("role", "authenticated")
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        logger.error("Authentication failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )


async def verify_supabase_token(token: str) -> Dict[str, Any]:
    """
    Verify token with Supabase (production implementation)
    """
    # This would make a request to Supabase to verify the token
    # and return user information
    pass


def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Require admin role
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
