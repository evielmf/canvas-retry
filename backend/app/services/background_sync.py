"""
Background Sync Service
Handles automated Canvas data synchronization
"""

import asyncio
import structlog
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json

from app.services.database_service import db_service
from app.services.canvas_service import CanvasAPIClient
from app.config import settings

logger = structlog.get_logger()


class BackgroundSyncService:
    """Background service for automated Canvas synchronization"""
    
    def __init__(self):
        self.is_running = False
        self.sync_interval = 7200  # 2 hours in seconds
        self.sync_tasks = {}
    
    async def start_scheduler(self):
        """Start the background sync scheduler"""
        self.is_running = True
        logger.info("Background sync scheduler started")
        
        while self.is_running:
            try:
                await self.run_scheduled_syncs()
                await asyncio.sleep(300)  # Check every 5 minutes
            except Exception as e:
                logger.error("Background sync scheduler error", error=str(e))
                await asyncio.sleep(60)  # Wait 1 minute before retrying
    
    async def stop_scheduler(self):
        """Stop the background sync scheduler"""
        self.is_running = False
        
        # Cancel all running sync tasks
        for task in self.sync_tasks.values():
            if not task.done():
                task.cancel()
        
        logger.info("Background sync scheduler stopped")
    
    async def run_scheduled_syncs(self):
        """Check and run scheduled synchronizations"""
        try:
            # Get all Canvas connections that need syncing
            connections_to_sync = await self._get_connections_needing_sync()
            
            for connection_data in connections_to_sync:
                user_id = str(connection_data['user_id'])
                connection_id = str(connection_data['id'])
                
                # Check if sync is already running for this connection
                task_key = f"{user_id}:{connection_id}"
                if task_key in self.sync_tasks and not self.sync_tasks[task_key].done():
                    continue
                
                # Start sync task
                logger.info(f"Starting background sync for connection {connection_id}")
                self.sync_tasks[task_key] = asyncio.create_task(
                    self._sync_connection(connection_data)
                )
        
        except Exception as e:
            logger.error("Failed to run scheduled syncs", error=str(e))
    
    async def _get_connections_needing_sync(self) -> List[Dict[str, Any]]:
        """Get Canvas connections that need synchronization"""
        try:
            # This would query the database for connections that:
            # 1. Are active/connected
            # 2. Haven't been synced in the last 2 hours
            # 3. Are not currently being synced
            
            # Placeholder - would be implemented with actual database query
            return []
            
        except Exception as e:
            logger.error("Failed to get connections needing sync", error=str(e))
            return []
    
    async def _sync_connection(self, connection_data: Dict[str, Any]):
        """Sync a single Canvas connection"""
        user_id = str(connection_data['user_id'])
        connection_id = str(connection_data['id'])
        
        try:
            # Get connection and decrypt token
            connection_with_token = await db_service.get_canvas_connection_with_token(connection_id)
            if not connection_with_token:
                logger.error(f"Connection {connection_id} not found")
                return
            
            connection, token = connection_with_token
            
            # Create sync log
            sync_log = await db_service.create_sync_log(user_id, connection_id, "automatic")
            
            # Initialize Canvas API client
            canvas_client = CanvasAPIClient(connection.canvas_url, token)
            
            # Fetch Canvas data
            logger.info(f"Fetching Canvas data for connection {connection_id}")
            canvas_data = await canvas_client.fetch_full_data_parallel()
            
            # Sync to database
            items_synced = await db_service.sync_canvas_data(user_id, connection_id, canvas_data)
            
            # Update sync log
            await db_service.update_sync_log(
                str(sync_log.id), 
                "completed", 
                items_synced
            )
            
            logger.info(
                f"Background sync completed for connection {connection_id}",
                items_synced=items_synced
            )
            
        except Exception as e:
            logger.error(f"Background sync failed for connection {connection_id}", error=str(e))
            
            # Update sync log with error
            if 'sync_log' in locals():
                await db_service.update_sync_log(
                    str(sync_log.id),
                    "failed",
                    0,
                    str(e)
                )
    
    async def trigger_manual_sync(self, user_id: str, connection_id: str, sync_type: str = "manual") -> str:
        """Trigger manual synchronization for a specific connection"""
        try:
            # Check if sync is already running
            task_key = f"{user_id}:{connection_id}"
            if task_key in self.sync_tasks and not self.sync_tasks[task_key].done():
                raise ValueError("Sync already in progress for this connection")
            
            # Get connection details
            connection_with_token = await db_service.get_canvas_connection_with_token(connection_id)
            if not connection_with_token:
                raise ValueError("Canvas connection not found")
            
            connection, token = connection_with_token
            
            # Create sync log
            sync_log = await db_service.create_sync_log(user_id, connection_id, sync_type)
            
            # Start sync task
            self.sync_tasks[task_key] = asyncio.create_task(
                self._manual_sync_task(user_id, connection, token, sync_log)
            )
            
            return str(sync_log.id)
            
        except Exception as e:
            logger.error(f"Failed to trigger manual sync", error=str(e))
            raise
    
    async def _manual_sync_task(self, user_id: str, connection, token: str, sync_log):
        """Execute manual sync task"""
        try:
            # Initialize Canvas API client
            canvas_client = CanvasAPIClient(connection.canvas_url, token)
            
            # Validate connection first
            validation = await canvas_client.validate_connection()
            if not validation.valid:
                raise ValueError(f"Canvas connection invalid: {validation.error_message}")
            
            # Fetch Canvas data with parallel processing
            logger.info(f"Starting manual sync for user {user_id}")
            canvas_data = await canvas_client.fetch_full_data_parallel()
            
            # Sync to database
            items_synced = await db_service.sync_canvas_data(user_id, str(connection.id), canvas_data)
            
            # Update sync log
            await db_service.update_sync_log(
                str(sync_log.id),
                "completed",
                items_synced
            )
            
            logger.info(
                f"Manual sync completed for user {user_id}",
                items_synced=items_synced,
                sync_log_id=str(sync_log.id)
            )
            
        except Exception as e:
            logger.error(f"Manual sync failed for user {user_id}", error=str(e))
            
            # Update sync log with error
            await db_service.update_sync_log(
                str(sync_log.id),
                "failed",
                0,
                str(e)
            )
            raise
    
    async def get_sync_status(self, user_id: str, connection_id: str) -> Dict[str, Any]:
        """Get current sync status for a connection"""
        task_key = f"{user_id}:{connection_id}"
        
        # Check if sync is currently running
        is_syncing = (
            task_key in self.sync_tasks and 
            not self.sync_tasks[task_key].done()
        )
        
        # Get recent sync logs
        recent_syncs = await db_service.get_recent_sync_logs(user_id, 5)
        connection_syncs = [
            sync for sync in recent_syncs 
            if str(sync.id) == connection_id
        ]
        
        last_sync = connection_syncs[0] if connection_syncs else None
        
        return {
            "is_syncing": is_syncing,
            "last_sync": last_sync.dict() if last_sync else None,
            "recent_syncs": [sync.dict() for sync in connection_syncs[:3]]
        }
    
    async def cancel_sync(self, user_id: str, connection_id: str) -> bool:
        """Cancel ongoing sync for a connection"""
        task_key = f"{user_id}:{connection_id}"
        
        if task_key in self.sync_tasks and not self.sync_tasks[task_key].done():
            self.sync_tasks[task_key].cancel()
            logger.info(f"Cancelled sync for connection {connection_id}")
            return True
        
        return False


# Global background sync service instance
background_sync = BackgroundSyncService()
