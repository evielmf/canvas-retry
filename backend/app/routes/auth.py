"""
Authentication Routes
"""

from fastapi import APIRouter

router = APIRouter()


@router.post("/login")
async def login():
    """Login endpoint - handled by Supabase on frontend"""
    return {"message": "Login handled by Supabase on frontend"}


@router.post("/logout")
async def logout():
    """Logout endpoint - handled by Supabase on frontend"""
    return {"message": "Logout handled by Supabase on frontend"}
