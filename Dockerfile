# =============================================================================
# Feature Toggle Service - Dockerfile (Node.js 22 LTS)
# Optimized for Azure Container Apps deployment
# Role: Central feature toggle service for the ConFuse platform
# Includes both backend API and frontend dashboard
# =============================================================================

FROM node:22-alpine AS frontend-builder

WORKDIR /app
# Copy frontend with its own tsconfig
WORKDIR /app/frontend
COPY feature-context-toggle/frontend/package*.json ./
RUN npm install
COPY feature-context-toggle/frontend ./
RUN npm run build || true

# =============================================================================
FROM node:22-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache dumb-init curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy root tsconfig (needed by backend)
COPY feature-context-toggle/tsconfig.json ./

# Copy database schema for initialization
COPY feature-context-toggle/database ./database

# Copy backend directory
WORKDIR /app/backend
COPY feature-context-toggle/backend/package*.json ./
RUN npm install && npm cache clean --force
COPY feature-context-toggle/backend ./

# Build TypeScript
RUN npm run build

# Copy frontend build from builder stage
COPY --from=frontend-builder /app/frontend/dist /app/backend/public

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app
USER nextjs

# =============================================================================
# Environment Variables (configure via Azure Container Apps environment settings)
# =============================================================================
# Required:
#   DATABASE_URL
# Optional (with defaults):
#   PORT=3099, NODE_ENV=production, CACHE_TTL_SECONDS=300
#   CORS_ORIGINS=<comma-separated-urls>
# =============================================================================

ENV NODE_ENV=production
ENV PORT=3099

EXPOSE 3099

# Health check optimized for Azure Container Apps
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3099}/health || exit 1

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run the backend
CMD ["node", "dist/index.js"]
