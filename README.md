# Feature Toggle

Developer feature toggle dashboard for the ConFuse platform. This is a private dev tool for controlling features, bypassing authentication during testing, and enabling debug modes.

> [!IMPORTANT]
> **Development Environment Only** — This tool is designed exclusively for local development and testing. Feature toggles configured here:
> - ✅ Affect local development servers when restarted
> - ❌ Do NOT affect production builds or deployments
> - ❌ Do NOT persist beyond the development environment
>
> Changes take effect after restarting the affected service(s).

## How to run the microservice

```bash
# Install dependencies
npm install

# Start both backend and frontend
npm run dev
```

- **Dashboard**: http://localhost:5173
- **Backend API**: http://localhost:3099

## Available Toggles

| Toggle | Description |
|--------|-------------|
| **Auth Bypass** | Bypass authentication and use a demo user for testing |
| **Debug Logging** | Enable verbose debug logging across all services |
| **Skip Rate Limiting** | Disable rate limiting for API endpoints during testing |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/toggles` | GET | Get all toggles |
| `/api/toggles/:name` | GET | Get a specific toggle |
| `/api/toggles/:name` | PATCH | Update toggle state |
| `/api/toggles/auth-bypass/user` | GET | Get demo user (when bypass enabled) |

## Deployment

### Environment Variables

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=confuse_shared
DB_USER=confuse
DB_PASSWORD=<password>

# Service Configuration
PORT=3099
NODE_ENV=production

# Frontend (Development)
FRONTEND_PORT=5173
```

### Production Deployment

#### Docker Deployment
```bash
# Build image
docker build -t confuse/feature-toggle .

# Run container
docker run -d \
  --name feature-toggle \
  -p 3099:3099 \
  -e DB_HOST=postgres \
  -e DB_PASSWORD=<password> \
  confuse/feature-toggle
```

#### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: feature-toggle
spec:
  replicas: 1
  selector:
    matchLabels:
      app: feature-toggle
  template:
    metadata:
      labels:
        app: feature-toggle
    spec:
      containers:
      - name: feature-toggle
        image: confuse/feature-toggle:latest
        ports:
        - containerPort: 3099
        env:
        - name: DB_HOST
          value: "postgres-service"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: confuse-secrets
              key: db-password
---
apiVersion: v1
kind: Service
metadata:
  name: feature-toggle-service
spec:
  selector:
    app: feature-toggle
  ports:
  - port: 3099
    targetPort: 3099
```

### Development Setup

```bash
# Install dependencies
npm install

# Start both backend and frontend
npm run dev

# Or start individually
npm run dev:backend    # Backend only on port 3099
npm run dev:frontend   # Frontend only on port 5173

# Build for production
npm run build

# Start production server
npm start
```

### Database Setup

```bash
# Create database
createdb confuse_shared

# Run migrations
cd database
npm run migrate

# Seed with default toggles
npm run seed
```

## Integration with auth-middleware

The auth-middleware service queries this toggle service to check if authentication should be bypassed:

```typescript
// In auth-middleware
const response = await fetch('http://localhost:3099/api/toggles/auth-bypass/user');
if (response.ok) {
  const { data } = await response.json();
  // Use demo user instead of requiring authentication
}
```

## Project Structure

```
feature-toggle/
├── backend/          # Express + TypeScript API
│   └── src/
│       ├── index.ts       # Server entry point with extensive logging
│       ├── database.ts    # PostgreSQL connection (NeonDB or container)
│       ├── cache.ts       # Redis caching layer
│       ├── config.ts      # Environment configuration
│       ├── routes/
│       │   └── toggles-db.ts  # Toggle API routes
│       └── types/index.ts
├── frontend/         # Vite + React dashboard
│   └── src/
│       ├── App.tsx        # Main dashboard with logging
│       ├── main.tsx
│       └── index.css
├── database/
│   └── schema.sql    # PostgreSQL schema
└── package.json      # Monorepo root
```

## Logging

The backend includes extensive structured logging for debugging and monitoring:

```
[STARTUP] Feature Toggle Service Starting...
[DATABASE] 📦 Database: NeonDB @ host:5432
[CACHE] ✅ Redis cache connected
[REQUEST] [req_xxx] GET /api/toggles started
[ROUTE] GET /api/toggles - Fetching all toggles
[DATABASE] [QUERY] getAllToggles returned 21 toggles
[CACHE] [SET-ALL] 21 toggles cached successfully
[RESPONSE] [req_xxx] [SUCCESS] GET /api/toggles 200 524ms
```

Log prefixes:
- `[STARTUP]` - Service initialization
- `[DATABASE]` - PostgreSQL operations
- `[CACHE]` - Redis cache operations
- `[REQUEST]` / `[RESPONSE]` - HTTP request lifecycle
- `[ROUTE]` - API route handling
- `[HEALTH]` - Health check operations

## Database Configuration

The service uses NeonDB (cloud PostgreSQL) as the database.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3099` |
| `DATABASE_URL` | NeonDB connection URL | Required |
| `DB_SCHEMA` | Database schema | `feature_toggles` |
| `REDIS_URL` | Redis connection URL | Required |

## License

Private - Internal use only
