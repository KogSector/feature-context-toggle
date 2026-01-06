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
│       ├── index.ts
│       ├── routes/toggles.ts
│       └── types/index.ts
├── frontend/         # Vite + React dashboard
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       └── index.css
├── toggles.json      # Toggle state storage
└── package.json      # Monorepo root
```

## License

Private - Internal use only