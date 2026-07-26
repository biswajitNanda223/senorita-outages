# Dockerfile
# Production-grade multi-stage Docker build for the enterprise demo application

#---------------------------------------------------------
# STAGE 1: Build Dependencies
#---------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency definition
COPY package*.json ./

# Install build dependencies and compile TypeScript
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

#---------------------------------------------------------
# STAGE 2: Runner Environment
#---------------------------------------------------------
FROM node:20-alpine

# Set secure production environment
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /usr/src/app

# Create a non-root group and user
RUN addgroup -g 1001 nodeapp && \
    adduser -u 1001 -G nodeapp -s /bin/sh -D nodeapp

# Copy dependencies from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Copy compiled application
COPY --from=builder /usr/src/app/dist ./dist
COPY public/ ./public/

# Fix directory ownership for non-root execution
RUN chown -R nodeapp:nodeapp /usr/src/app

# Switch to non-root user context
USER nodeapp

EXPOSE 8080

# Configure health check for Kubernetes liveness/readiness compatibility
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('node:http').get('http://localhost:8080/health', (r) => { if (r.statusCode !== 200) process.exit(1); }).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
