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

## ☸️ Part 2: Kubernetes Core Concepts & Deep-Dive Architecture

Kubernetes (K8s) is an open-source container orchestration platform that automates the deployment, scaling, load balancing, and self-healing management of containerized applications.

---

### 🏗️ 1. Complete Cluster Architecture: Master Node (Control Plane) vs. Worker Node

```mermaid
graph TD
    subgraph Master_Node ["🎮 MASTER NODE (Control Plane) - Brain of the Cluster"]
        APIServer["1️⃣ kube-apiserver\n(API Gateway & Auth)"]
        Etcd["2️⃣ etcd\n[(Distributed Key-Value Store)]"]
        Scheduler["3️⃣ kube-scheduler\n(Node Placement Engine)"]
        KCM["4️⃣ kube-controller-manager\n(Reconciliation Loops)"]
        CCM["5️⃣ cloud-controller-manager\n(AWS/Azure/GCP Integration)"]

        APIServer <==> Etcd
        APIServer <--> Scheduler
        APIServer <--> KCM
        APIServer <--> CCM
    end

    subgraph Worker_Node_1 ["🚚 WORKER NODE 1 - Executes Workloads"]
        Kubelet1["kubelet agent\n(Node Supervisor)"]
        Proxy1["kube-proxy\n(L4 Network Router)"]
        CRI1["Container Runtime\n(containerd / CRI-O)"]

        subgraph Pod1 ["📦 Pod: App Namespace"]
            C1["Container: Fastify App\n(Port 8080)"]
            C2["Container: FluentBit Sidecar\n(Log Shipper)"]
        end

        Kubelet1 <--> CRI1
        CRI1 --> Pod1
    end

    subgraph Worker_Node_2 ["🚚 WORKER NODE 2 - Executes Workloads"]
        Kubelet2["kubelet agent\n(Node Supervisor)"]
        Proxy2["kube-proxy\n(L4 Network Router)"]
        CRI2["Container Runtime\n(containerd / CRI-O)"]

        subgraph Pod2 ["📦 Pod: App Namespace"]
            C3["Container: Fastify App\n(Port 8080)"]
        end

        Kubelet2 <--> CRI2
        CRI2 --> Pod2
    end

    APIServer <==>|Secure HTTPS / gRPC| Kubelet1
    APIServer <==>|Secure HTTPS / gRPC| Kubelet2
    Proxy1 <-->|Virtual Network Mesh| Proxy2
```

---

### 🎮 The Master Node (Control Plane) Components

The Master Node is the **brain** of the Kubernetes cluster. It makes global decisions (scheduling), detects cluster events, and responds to failures.

1. **`kube-apiserver` (The Entry Gateway):**
   - The central communication hub. Every request (from `kubectl`, CI/CD pipelines, or internal node agents) passes through the API Server.
   - Performs Authentication, Authorization (RBAC), Admission Control, and validation.
   - It is the **only** component that talks directly to `etcd`.

2. **`etcd` (The Source of Truth):**
   - A highly available, consistent distributed key-value store holding the entire cluster state, configuration, and secret data.
   - If a pod dies, `etcd` still holds the desired spec. The cluster restores it automatically.

3. **`kube-scheduler` (The Placement Director):**
   - Watches for newly created Pods that have no node assigned (`nodeName: ""`).
   - Evaluates node resource constraints (CPU/Memory), taints/tolerations, node affinity rules, and selects the optimal worker node to run the pod.

4. **`kube-controller-manager` (The Self-Healing Engine):**
   - Runs continuous control loops (reconciliation loops) that compare **actual state vs. desired state**.
   - Includes:
     - *Node Controller:* Detects when a worker node goes offline.
     - *ReplicaSet Controller:* Ensures the exact requested number of pod replicas are running.
     - *Endpoints Controller:* Populates Service endpoints for load balancing.

5. **`cloud-controller-manager` (Cloud Provider Bridge):**
   - Connects Kubernetes to AWS (AWS Controller), Azure (Azure Resource Provider), or GCP (GKE Controller).
   - Provisions cloud infrastructure like AWS ALBs, Azure Load Balancers, or GCP Network Load Balancers automatically when a `kind: Service` of `type: LoadBalancer` is created.

---

### 🚚 The Worker Node Components

Worker Nodes are the **muscle** of the cluster. They run the actual containerized applications.

1. **`kubelet` (The Node Supervisor):**
   - An agent running on every worker node.
   - Receives `PodSpecs` from the API Server and instructs the Container Runtime to start or stop containers.
   - Performs Liveness & Readiness health check probes on running pods and reports status back to the API Server.

2. **`kube-proxy` (The Network Traffic Manager):**
   - Maintains network rules (using `iptables` or `IPVS`) on each node.
   - Enables Layer 4 network routing between Pods across different nodes and distributes traffic sent to a `ClusterIP` Service across its backend Pod IPs.

3. **`Container Runtime` (The Execution Engine):**
   - The low-level engine that actually runs the containers (e.g. `containerd`, `CRI-O`).
   - Uses Linux namespaces (for process isolation) and cgroups (for CPU/Memory limits).

---

### 📦 Object Hierarchy & Relationships: Namespaces, Pods & Containers

```mermaid
graph TD
    Cluster[☸️ Kubernetes Cluster] --> NS1[🏷️ Namespace: production]
    Cluster --> NS2[🏷️ Namespace: staging]

    NS1 --> Quota[📏 ResourceQuota & LimitRange]
    NS1 --> Deploy[🚀 Deployment: fastify-backend]

    Deploy --> RS[🔄 ReplicaSet: fastify-backend-7f9b8c]

    RS --> Pod1["📦 Pod 1: fastify-backend-7f9b8c-x89zk\n(IP: 10.244.1.15)"]
    RS --> Pod2["📦 Pod 2: fastify-backend-7f9b8c-m42ab\n(IP: 10.244.2.22)"]

    subgraph Pod_Detail ["Inside Pod 1 (Shares localhost & network namespace)"]
        Pod1 --> C1["🐳 Main Container: Fastify Node.js App\n(localhost:8080)"]
        Pod1 --> C2["🐳 Sidecar Container: FluentBit Log Shipper\n(Reads /var/log)"]
        Pod1 --> Vol["💾 Shared Volume: /var/log"]
    end
```

---

### 🏷️ 1. Namespaces (Logical Cluster Partitioning)
A **Namespace** is a virtual cluster inside a physical cluster used to isolate environments and tenants.
- **Tenant Isolation:** Separates `production`, `staging`, and `development` workloads so they do not accidentally interfere.
- **Resource Quotas (`ResourceQuota`):** Enforces hard caps on CPU and Memory usage per team/namespace.
- **RBAC Boundaries:** Restricts developers to read/write access only in their assigned namespace.

---

### 📦 2. Pods (The Smallest Deployable Unit)
A **Pod** is the atomic building block in Kubernetes. You never deploy a container directly in K8s; you deploy a Pod that wraps one or more containers.
- **Why Pods instead of Containers?** 
  - Containers inside the same Pod share the **same network IP**, **localhost interface**, and **storage volumes**.
  - *Multi-Container Pod Patterns:*
    - **Sidecar Pattern:** A secondary container (e.g. FluentBit) sits alongside the main application container to ship logs or proxy traffic (Envoy service mesh).
    - **Init Containers:** Run and complete *before* the main app container starts (e.g. running database migrations).

---

### 🐳 3. Containers (Process Execution)
A **Container** is a lightweight, isolated process running on Linux kernel primitives:
- **Namespaces:** Isolates Process IDs (`PID`), Network Interfaces (`NET`), Mount points (`MNT`), and Inter-Process Communication (`IPC`).
- **Control Groups (cgroups):** Enforces hard resource limits (e.g., "This container cannot consume more than 512MB RAM").

---

### 🔄 What Happens Step-by-Step When You Run `kubectl apply -f deployment.yaml`?

```mermaid
sequenceDiagram
    autonumber
    actor Dev as 👩‍💻 DevOps Engineer
    participant Kubectl as 💻 kubectl CLI
    participant API as 🎮 kube-apiserver
    participant Etcd as 💾 etcd DB
    participant Sched as 🧩 kube-scheduler
    participant KCM as 🔄 ReplicaSet Controller
    participant Kubelet as 🚚 Worker Kubelet
    participant CRI as 🐳 containerd Runtime

    Dev->>Kubectl: kubectl apply -f deployment.yaml
    Kubectl->>API: HTTP POST /apis/apps/v1/namespaces/prod/deployments
    API->>API: Authenticate & Authorize RBAC + Validate YAML
    API->>Etcd: Save Deployment spec to etcd
    API-->>Kubectl: 201 Created (Deployment Created)

    KCM->>API: Watch Event: New Deployment detected!
    KCM->>API: Create ReplicaSet (Desired: 3 replicas)
    API->>Etcd: Store ReplicaSet in etcd

    KCM->>API: ReplicaSet Controller creates 3 Unscheduled Pods
    API->>Etcd: Store 3 Pods (nodeName: "")

    Sched->>API: Watch Event: Unscheduled Pods detected!
    Sched->>Sched: Evaluate Nodes (CPU, RAM, Taints, Affinity)
    Sched->>API: Assign Node (Pod 1 -> Worker 1, Pod 2 -> Worker 2)
    API->>Etcd: Update Pod spec with nodeName

    Kubelet->>API: Watch Event: Pod assigned to MY node!
    Kubelet->>CRI: Pull Container Image & Create Network Namespace
    CRI-->>Kubelet: Containers Started!
    Kubelet->>API: Update Pod Status = Running
    API->>Etcd: Persist Running Status in etcd
```

---

### 2. Core Kubernetes Resource Types Reference Table

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

