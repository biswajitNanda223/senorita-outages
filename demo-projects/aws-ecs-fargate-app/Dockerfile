# Dockerfile
# Production-ready multi-stage Docker build for AWS ECS Fargate Fastify workload

#---------------------------------------------------------
# WHY MULTI-STAGE IS IMPORTANT:
# 1. Image Size Reduction: Extracts only node_modules and code, keeping the run image thin.
# 2. Strict Privilege Separation: Container executes under non-root context.
#---------------------------------------------------------

# STAGE 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

# Compile TypeScript and remove development dependencies
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

# STAGE 2: Lean runtime runner
FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /usr/src/app

# Create non-root group and user
RUN addgroup -g 1001 ecsrunner && \
    adduser -u 1001 -G ecsrunner -s /bin/sh -D ecsuser

# Copy dependencies
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Copy compiled code
COPY --from=builder /usr/src/app/dist ./dist

# Fix ownership
RUN chown -R ecsuser:ecsrunner /usr/src/app

# Switch to non-root
USER ecsuser

EXPOSE 8080

CMD ["node", "dist/server.js"]
