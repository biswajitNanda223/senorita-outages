# 🐳 Docker & Kubernetes Master Guide: Basic to Advanced
## *MasalaOps Presents: "The Container Blockbuster!"*

> [!NOTE]
> **Director's Note:** In this architectural blockbuster, Docker acts as our character design (packaging the app securely), and Kubernetes acts as our choreographer (orchestrating thousands of containers on stage, ensuring nobody collides or falls!).

---

## 📦 Part 1: Docker (Basic to Advanced)

### 1. The Image Layer Architecture
Docker images are built as a stack of read-only, immutable layers. Each command in a `Dockerfile` (like `RUN`, `COPY`, `ADD`) creates a new layer.

```mermaid
graph TD
    ContainerLayer[Container Layer - Read/Write] --> Layer3[Layer 3: COPY server.js - Read-Only]
    Layer3 --> Layer2[Layer 2: RUN npm install - Read-Only]
    Layer2 --> Layer1[Layer 1: FROM node:alpine - Read-Only Base]
```

*   **Union File System:** When you run a container, Docker adds a thin read-write **Container Layer** on top of the stack. All file writes, modifications, and deletions occur in this temporary layer.
*   **Copy-On-Write (CoW):** If a container needs to modify a file in a lower read-only layer, Docker copies the file up to the container layer first, leaving the base image untouched.

### 2. Cache Optimization (Order Matters!)
Docker caches layer outputs to speed up subsequent builds. If a layer's contents change, its cache *and all subsequent layers' caches* are invalidated.

#### ❌ Inefficient Dockerfile (Invalidates cache on every minor code change):
```dockerfile
FROM node:20-alpine
WORKDIR /usr/src/app
COPY . .
# If any file changes, the cache is busted here, forcing npm install to run again!
RUN npm install
CMD ["node", "server.js"]
```

#### ✅ Optimized Dockerfile (Caches dependencies):
```dockerfile
FROM node:20-alpine
WORKDIR /usr/src/app
# Copy package files first
COPY package*.json ./
# npm install only runs if package.json changes
RUN npm ci --only=production
# Copy source code last (changes frequently)
COPY . .
CMD ["node", "server.js"]
```

### 3. Advanced Security & Distroless Images
*   **Non-Root Execution:** By default, containers run as `root` user. If an attacker escapes the container, they gain root access to the host machine. Always enforce a non-privileged user.
*   **Distroless & Scratch:** Remove shell utilities, package managers, and standard system tools from production images. By using `FROM scratch` or `Google's Distroless` base images, you reduce the attack surface to almost zero.

---

## 💻 4. Code Example: Secure Multi-Stage Dockerfile

This production Dockerfile shows how to build and package a Fastify application using a multi-stage approach, locking down runtimes to a non-privileged user:

```dockerfile
# Dockerfile
# STAGE 1: Build & Package dependencies
FROM node:20.11.0-alpine AS builder

WORKDIR /usr/src/app

# Copy lock files for exact version pinning
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# STAGE 2: Secure Runtime Image
FROM node:20.11.0-alpine

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /usr/src/app

# Create a dedicated non-root user and group
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Copy dependencies and files from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY server.js ./

# Fix filesystem permissions
RUN chown -R appuser:appgroup /usr/src/app

# Switch to the non-root user
USER appuser

EXPOSE 8080

CMD ["node", "server.js"]
```

---

## 💻 5. Code Example: Multi-Container Local Compose Orchestration

This `docker-compose.yml` configures a complete local stack consisting of our Fastify application container, a PostgreSQL database, and a Redis cache:

```yaml
# docker-compose.yml
version: "3.8"

services:
  # 1. Fastify Backend Server (The Hero)
  backend:
    build:
      context: ./demo-app
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - PORT=8080
      - DATABASE_URL=postgresql://postgres:mysecretpassword@postgres-db:5432/enterprise_db
      - REDIS_URL=redis://redis-cache:6379
    depends_on:
      postgres-db:
        condition: service_healthy
      redis-cache:
        condition: service_started
    networks:
      - app-network

  # 2. PostgreSQL Database (The Scriptwriter Data Store)
  postgres-db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=mysecretpassword
      - POSTGRES_DB=enterprise_db
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d enterprise_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  # 3. Redis Cache (The Backup Dancer)
  redis-cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres-data:
    driver: local
  redis-data:
    driver: local
```

---

## ☸️ Part 2: Kubernetes Core Concepts

Kubernetes (K8s) is an orchestration platform designed to automate the deployment, scaling, and management of containerized applications.

### 1. Kubernetes Architecture (Control Plane vs. Node)

```mermaid
graph TD
    subgraph Control_Plane [Control Plane]
        APIServer[API Server]
        Etcd[(etcd State Database)]
        Scheduler[Scheduler]
        ControllerManager[Controller Manager]
        APIServer --- Etcd
        APIServer --- Scheduler
        APIServer --- ControllerManager
    end
    
    subgraph Worker_Node [Worker Node]
        Kubelet[Kubelet Agent]
        KubeProxy[Kube-proxy Router]
        Runtime[Container Runtime containerd]
        Kubelet --- Runtime
    end
    
    APIServer <==>|Coordinates| Kubelet
```

#### The Control Plane:
1.  **API Server (kube-apiserver):** The gateway of the cluster. Receives all CRUD requests (via kubectl or internal APIs) and validates them.
2.  **etcd:** A secure, distributed key-value store holding the absolute cluster configuration and state.
3.  **Scheduler (kube-scheduler):** Watches for newly created Pods with no assigned nodes, and selects the best node based on resource requirements.
4.  **Controller Manager (kube-controller-manager):** Run loops that maintain the desired state (e.g. Node Controller, Replication Controller).

#### The Worker Node:
1.  **Kubelet:** The local agent running on each worker node. It communicates with the API Server and ensures the containers described in PodSpecs are running and healthy.
2.  **Kube-proxy:** Handles internal and external networking routing and load balancing across pod IPs.
3.  **Container Runtime:** The software that runs the containers (e.g. `containerd` or Docker).

### 2. Core Kubernetes Resource Types

*   **Pods:** The smallest deployable unit. Houses one or more tightly coupled containers sharing network and storage namespace.
*   **Deployments:** Declares the desired state of Pods (e.g., "Run 3 replicas of the frontend container"). Automates rolling updates and rollbacks.
*   **Services:** Provides a stable IP address and DNS entry to access Pods.
    *   *ClusterIP:* Accessible only inside the cluster (default).
    *   *NodePort:* Exposes the service on a static port on each worker node IP.
    *   *LoadBalancer:* Provisions an external load balancer in the cloud (AWS/Azure/GCP).
*   **Ingress:** Acts as the entry WAF / HTTP router (Layer 7 Load Balancer), routing requests to target Services based on paths/hosts.
*   **ConfigMaps & Secrets:** Inject configurations and base64 encoded sensitive keys respectively into Pod containers at runtime.
*   **Persistent Volumes (PV) & Persistent Volume Claims (PVC):** Manages lifecycle-independent storage disks detached from pods' runtime boundaries.
*   **Network Policies:** L3/L4 firewalls restricting network flows between namespaces and pod labels.

---

## ⚙️ 3. Production Configuration Example: Kubernetes Deployment Spec

This YAML manifest demonstrates an enterprise-grade Deployment configuration, featuring **resource boundaries**, **readiness/liveness probes**, **non-root security context**, and **secret injection**:

```yaml
# deployment-production.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: enterprise-app-deployment
  namespace: production
  labels:
    app: backend-hero
    environment: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend-hero
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1       # Provisions at most 1 extra pod during rolling updates
      maxUnavailable: 0 # Ensures 100% capacity remains active during updates
  template:
    metadata:
      labels:
        app: backend-hero
    spec:
      # Pod-level security settings
      securityContext:
        runAsNonRoot: true     # Prevents container execution as root
        runAsUser: 1001        # Enforces specific non-privileged system user ID
        fsGroup: 1001          # Group ID for mapped storage disk ownership
      
      containers:
      - name: fastify-app
        image: myregistry.azurecr.io/app-backend:v1.2.0
        imagePullPolicy: IfNotPresent
        
        # Port container listens on
        ports:
        - containerPort: 8080
          name: http-port
        
        # Enforce exact memory and CPU boundaries (prevents noisy-neighbor bugs)
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        # Self-healing probes
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 20
        
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        
        # Environment variables injection
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_HOST
          valueFrom:
            configMapKeyRef:
              name: app-configmap
              key: db_host
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secret
              key: db_password
```

