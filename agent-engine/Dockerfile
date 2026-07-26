# Dockerfile
# Production-grade multi-stage Docker build for the AI Agent Engine

#---------------------------------------------------------
# STAGE 1: Build Dependencies
#---------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

# Install dependencies, compile TypeScript, then prune build tools
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

#---------------------------------------------------------
# STAGE 2: Runner Environment
#---------------------------------------------------------
FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /usr/src/app

# Create a non-root group and user
RUN addgroup -g 1001 agentgroup && \
    adduser -u 1001 -G agentgroup -s /bin/sh -D agentuser

# Copy dependencies
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Copy compiled application
COPY --from=builder /usr/src/app/dist ./dist

# Fix directory ownership
RUN chown -R agentuser:agentgroup /usr/src/app

# Switch to non-root user
USER agentuser

EXPOSE 8080

# Configure health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('node:http').get('http://localhost:8080/health', (r) => { if (r.statusCode !== 200) process.exit(1); }).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
