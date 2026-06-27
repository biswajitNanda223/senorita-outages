# Dockerfile
# Production-ready multi-stage Docker build for the Azure Function App workload

#---------------------------------------------------------
# WHY MULTI-STAGE IS IMPORTANT:
# 1. Smaller Image Size: We separate the build environment (with heavy compilers/devDependencies)
#    from the lean runtime environment (with only production dependencies).
# 2. Security (Reduced Attack Surface): By excluding build-time tools (like gcc, npm caches,
#    git, development logs), attackers cannot leverage them if the container is compromised.
# 3. Non-Root Execution: We explicitly run as a non-privileged system user rather than root.
#---------------------------------------------------------

# STAGE 1: Build Dependencies
FROM mcr.microsoft.com/azure-functions/node:4-node20 AS builder

WORKDIR /home/site/wwwroot

COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# STAGE 2: Secure Production Runner
FROM mcr.microsoft.com/azure-functions/node:4-node20

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureWebJobsStorage="" \
    FUNCTIONS_WORKER_RUNTIME=node

WORKDIR /home/site/wwwroot

# Create a non-root group and user for security isolation
RUN addgroup -g 1001 runtimegroup && \
    adduser -u 1001 -G runtimegroup -s /bin/sh -D runtimeuser

# Copy dependencies and application source code
COPY --from=builder /home/site/wwwroot/node_modules ./node_modules
COPY --from=builder /home/site/wwwroot/package*.json ./
COPY host.json local.settings.json index.js ./

# Set folder ownership to the non-root user
RUN chown -R runtimeuser:runtimegroup /home/site/wwwroot

# Switch to non-privileged user
USER runtimeuser

EXPOSE 80
