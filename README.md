# Feature Context Toggle

Developer feature toggle dashboard for the ConFuse platform. This is a private dev tool for controlling features, bypassing authentication during testing, and enabling debug modes.

> [!IMPORTANT]
> **Development Environment Only** — This tool is designed exclusively for local development and testing. Feature toggles configured here:
> - ✅ Affect local development servers when restarted
> - ❌ Do NOT affect production builds or deployments
> - ❌ Do NOT persist beyond the development environment
>
> Changes take effect after restarting the affected service(s).

## Quick Start

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
feature-context-toggle/
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
[STARTUP] Feature Context Toggle Service Starting...
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

The service supports two database modes via `USE_CONTAINER_DB` environment variable:

| Mode | Description |
|------|-------------|
| `USE_CONTAINER_DB=false` | Use NeonDB (cloud PostgreSQL) - **default** |
| `USE_CONTAINER_DB=true` | Use local PostgreSQL container |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3099` |
| `USE_CONTAINER_DB` | Use container or NeonDB | `false` |
| `REDIS_URL` | Redis connection URL | Required |
| `NEON_DB_HOST` | NeonDB host (if cloud) | Required |
| `DB_HOST` | Container DB host | `localhost` |

## License

Private - Internal use only