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

# Install production dependencies only
RUN npm ci --only=production

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

# Copy code
COPY server.js ./

# Fix ownership
RUN chown -R ecsuser:ecsrunner /usr/src/app

# Switch to non-root
USER ecsuser

EXPOSE 8080

CMD ["node", "server.js"]
