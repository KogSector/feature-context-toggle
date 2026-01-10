# Feature Toggle Backend - Dockerfile (Node.js 24 LTS)
FROM node:24-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache wget

# Copy root tsconfig (needed by backend)
COPY tsconfig.json ./

# Copy backend directory
COPY backend ./backend

# Install all dependencies (including dev for build)
WORKDIR /app/backend
RUN npm install

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Set environment
ENV NODE_ENV=production
ENV PORT=3099

EXPOSE 3099

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3099/health || exit 1

# Run the backend
CMD ["node", "dist/index.js"]
