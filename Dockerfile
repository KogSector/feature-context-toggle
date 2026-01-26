# =============================================================================
# Feature Toggle Service - Dockerfile (Node.js 24 LTS)
# Role: Central feature toggle service for the ConFuse platform
# Includes both backend API and frontend dashboard
# =============================================================================

FROM node:24-alpine AS frontend-builder

WORKDIR /app
# Copy root tsconfig (frontend extends it)
COPY tsconfig.json ./
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build

# =============================================================================
FROM node:24-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache wget

# Copy root tsconfig (needed by backend)
COPY tsconfig.json ./

# Copy database schema for initialization
COPY database ./database

# Copy backend directory
COPY backend ./backend

# Install dependencies
WORKDIR /app/backend
RUN npm install

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Copy frontend build from builder stage
COPY --from=frontend-builder /app/frontend/dist /app/backend/public

# =============================================================================
# Environment Variables (configure via docker run -e or docker-compose)
# =============================================================================
# Required:
#   DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, REDIS_URL
# Optional (with defaults):
#   PORT=3099, NODE_ENV=production, DB_PORT=5432, DB_SCHEMA=feature_toggles
#   CACHE_TTL_SECONDS=5, CORS_ORIGINS=<comma-separated-urls>
# =============================================================================

ENV NODE_ENV=production
ENV PORT=3099

EXPOSE 3099

# Health check using PORT environment variable
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3099}/health || exit 1

# Run the backend
CMD ["node", "dist/index.js"]
