# FastAPI Canvas Integration Backend

A high-performance FastAPI backend for Canvas LMS integration with parallel data fetching and secure token management.

## Features

- 🔐 **Secure Token Management**: AES-256 encryption for Canvas API tokens
- ⚡ **Parallel Data Fetching**: High-performance async Canvas API integration
- 🔄 **Background Sync**: Automated data synchronization every 2 hours
- 📊 **Real-time Analytics**: Dashboard statistics and insights
- 🛡️ **Security First**: JWT authentication, rate limiting, CORS protection
- 📈 **Scalable Architecture**: Async/await with connection pooling

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Update with your values:
- Database connection string
- Supabase credentials
- Canvas encryption key
- Redis URL (for background tasks)

### 3. Start the Server

```bash
python start.py
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Canvas Integration

- `POST /api/v1/canvas/setup` - Setup Canvas integration with API token
- `GET /api/v1/canvas/connections` - Get user's Canvas connections
- `PUT /api/v1/canvas/connections/{id}/token` - Update Canvas API token
- `POST /api/v1/canvas/connections/{id}/validate` - Validate connection
- `POST /api/v1/canvas/connections/{id}/sync` - Trigger manual sync

### Data Access

- `GET /api/v1/canvas/courses` - Get user's courses
- `GET /api/v1/canvas/assignments` - Get assignments (with filtering)
- `GET /api/v1/canvas/grades` - Get grades
- `GET /api/v1/canvas/data` - Get all Canvas data

### Sync Management

- `GET /api/v1/sync/logs` - Get sync history
- `GET /api/v1/sync/status` - Get current sync status
- `DELETE /api/v1/sync/connections/{id}` - Cancel ongoing sync

### Dashboard

- `GET /api/v1/dashboard/stats` - Get dashboard statistics

## Architecture

### Parallel Data Fetching

The Canvas service uses asyncio for parallel API requests:

```python
# Fetch all course data in parallel
async def fetch_full_data_parallel(self):
    courses = await self.get_courses()
    
    # Parallel fetch for all courses
    tasks = [self.fetch_course_data(course.id) for course in courses]
    results = await asyncio.gather(*tasks)
```

### Secure Token Management

Canvas API tokens are encrypted with AES-256:

```python
# Encrypt token before storage
encrypted_token, key = CanvasTokenManager.encrypt_token(api_token)

# Decrypt for API calls
decrypted_token = CanvasTokenManager.decrypt_token(encrypted_token, key)
```

### Background Synchronization

Automated sync every 2 hours:

```python
# Background service monitors connections
async def run_scheduled_syncs(self):
    connections = await self.get_connections_needing_sync()
    for connection in connections:
        await self.sync_connection(connection)
```

## Performance Features

- **Connection Pooling**: Database connection reuse
- **Request Batching**: Parallel Canvas API calls
- **Caching Strategy**: Minimize redundant API calls
- **Rate Limiting**: Respect Canvas API limits
- **Retry Logic**: Automatic retry with exponential backoff

## Security Features

- **JWT Authentication**: Supabase integration
- **Token Encryption**: AES-256 for Canvas tokens
- **Rate Limiting**: API endpoint protection
- **CORS Configuration**: Cross-origin request control
- **Security Headers**: XSS, CSRF protection

## Monitoring & Logging

- **Structured Logging**: JSON format with request tracing
- **Error Tracking**: Comprehensive error handling
- **Performance Metrics**: Request duration tracking
- **Sync Monitoring**: Background operation status

## Development

### Running Tests

```bash
pytest
```

### Code Quality

```bash
# Format code
black app/

# Type checking
mypy app/

# Linting
flake8 app/
```

## Production Deployment

### Docker

```dockerfile
FROM python:3.11-slim
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app/ app/
CMD ["python", "start.py"]
```

### Environment Variables

Production requires:
- `DATABASE_URL`: PostgreSQL connection
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_KEY`: Service role key
- `CANVAS_ENCRYPTION_KEY`: 32-character encryption key
- `REDIS_URL`: Redis for background tasks

## Integration with Frontend

### Next.js Integration

```typescript
// Frontend Canvas setup
const setupCanvas = async (canvasUrl: string, apiToken: string) => {
  const response = await fetch('/api/v1/canvas/setup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      canvas_url: canvasUrl,
      canvas_name: 'My University',
      api_token: apiToken
    })
  });
  
  return response.json();
};
```

### Real-time Updates

WebSocket support for real-time sync status:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/sync-status');
ws.onmessage = (event) => {
  const status = JSON.parse(event.data);
  updateSyncUI(status);
};
```

## Canvas API Token Setup

Students need to:

1. Go to Canvas → Account → Settings
2. Scroll to "Approved Integrations"
3. Click "+ New Access Token"
4. Enter purpose: "EaseBoard Integration"
5. Copy the generated token
6. Paste into your application

## Support

For issues and feature requests, please check the documentation or contact support.

---

Built with ❤️ for student success
