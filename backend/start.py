#!/usr/bin/env python3
"""
FastAPI Development Server Startup Script
"""

import asyncio
import uvicorn
import sys
import os

# Add app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.config import settings
from app.services.database_service import db_service

async def startup():
    """Initialize services on startup"""
    print("🚀 Starting Canvas API Backend...")
    
    # Initialize database connection pool
    try:
        await db_service.init_pool()
        print("✅ Database connection established")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)

def main():
    """Main entry point"""
    print("🎓 Canvas API Integration Backend")
    print("=" * 50)
    
    # Run startup tasks
    asyncio.run(startup())
    
    # Start server
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True
    )

if __name__ == "__main__":
    main()
