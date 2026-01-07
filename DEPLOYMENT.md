# Feature Context Toggle Service

Developer feature toggle service for ConFuse platform. Controls feature flags across all microservices.

## Deployment

### Environment Variables

```env
DB_HOST=<postgres-host>
DB_PORT=5432
DB_NAME=confuse_shared
DB_USER=confuse
DB_PASSWORD=<password>
PORT=3099
NODE_ENV=production
```

### Install & Run

```bash
# Backend
cd backend
npm install
npm run build
npm start

# Frontend (optional)
npm run dev:frontend
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/dist ./dist
ENV PORT=3099
EXPOSE 3099
CMD ["node", "dist/index.js"]
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/toggles` | GET | Get all toggles |
| `/api/toggles/:name` | GET | Get specific toggle |
| `/api/toggles/:name` | PATCH | Update toggle |
| `/api/toggles/auth-bypass/user` | GET | Get demo user |

## Available Toggles

- **authBypass**: Bypass authentication (dev only)
- **debugLogging**: Enable debug logs
- **skipRateLimiting**: Disable rate limits
- **useSharedDatabase**: Use shared DB
- **enableDistributedTracing**: Enable tracing

## Integration

Services query this API to check toggle status:

```typescript
const response = await fetch('http://toggle-service:3099/api/toggles/authBypass');
const { data } = await response.json();
if (data.enabled) {
  // Feature is enabled
}
```

## Database Schema

Uses `feature_toggles` schema in shared database:

```sql
CREATE TABLE feature_toggles.toggles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    category VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb
);
```