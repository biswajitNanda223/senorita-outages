# Multi-Cloud DevOps & DevSecOps Monorepo

Welcome to the Multi-Cloud DevOps Monorepo. This repository provides an end-to-end blueprint and infrastructure-as-code (IaC) templates, CI/CD pipelines, and Kubernetes deployment manifests for provisioning and deploying secure, production-grade applications on **Microsoft Azure**, **Amazon Web Services (AWS)**, and **Google Cloud Platform (GCP)**.

> [!NOTE]
> This repository is structured as a monorepo, separating infrastructure, CI/CD logic, and deployment manifests by cloud provider. It implements rigorous network isolation, DNS mapping, SSO configurations, and a secure build-push-sync container registry pipeline.

---

## 🗺️ Monorepo Directory Layout

```text
.
├── README.md                           # Main documentation & multi-cloud comparative guide
├── docs/                               # High-Level Design (HLD) files & architecture diagrams
│   ├── azure-hld.md                    # Azure Design: AKS, Container Apps, Functions, ACR, VNet, SSO, VM
│   ├── aws-hld.md                      # AWS Design: EKS, ECS Fargate, ECR, Route 53, Cognito
│   ├── gcp-hld.md                      # GCP Design: GKE, Cloud Run, Memorystore, Cloud SQL, Cloud DNS
│   ├── network-security.md             # Firewall configs, domain whitelisting, private link, DNS maps
│   ├── compute-decision-matrix.md      # Compute Decision Guide: "When to use what"
│   ├── eraser/                         # Eraser.io Diagram-as-Code files (DSL files)
│   │   ├── azure-architecture.txt
│   │   ├── aws-architecture.txt
│   │   ├── gcp-architecture.txt
│   │   ├── demo-deployment-flow.txt
│   │   └── compute-decision-tree.txt
│   └── images/                         # Generated architecture visualizations
│       ├── azure_architecture.png
│       ├── aws_architecture.png
│       └── gcp_architecture.png
├── terraform/                          # Infrastructure as Code (IaC) by provider
│   ├── azure/                          # VNet, AKS, Container Apps, Functions, Redis, ACR, Postgres, App Reg
│   ├── aws/                            # VPC, EKS, ECS, ECR, ElastiCache, RDS, IAM
│   └── gcp/                            # VPC, GKE, Cloud Run, Artifact Registry, Memorystore, Cloud SQL
├── cicd/                               # CI/CD orchestration
│   ├── gitlab-ci/
│   │   ├── templates/                  # Reusable pipeline steps (linter, build-sync, deploy)
│   │   └── .gitlab-ci.yml              # GitLab main pipeline file
│   └── scripts/
│       └── sync-registry.sh            # Container Registry sync helper script
├── manifests/                          # Deployment manifests (Kubernetes, Helm, Cloud specs)
│   ├── azure/                          # AKS ingress, deployment YAMLs, Container App specs
│   ├── aws/                            # EKS Helm charts, ECS task definitions
│   └── gcp/                            # GKE YAML manifests, Cloud Run Service definitions
├── demo-app/                           # Node.js + PostgreSQL + Redis Demo Application
│   ├── public/                         # Beautiful glassmorphic dashboard
│   │   └── index.html                  # Live status client page
│   ├── server.js                       # Express connection handlers (caching, endpoints)
│   ├── package.json                    # Application metadata and scripts
│   └── Dockerfile                      # Production-grade multi-stage runner spec
├── gemini.md                           # AI prompt guide and DevSecOps learning resource
└── agent.md                            # Rules and instructions for local agents / automation tools
```

---

## ☁️ Multi-Cloud Feature Comparison Matrix

The table below illustrates how common service patterns map across our three supported cloud platforms:

| Architectural Component | Microsoft Azure | Amazon Web Services (AWS) | Google Cloud Platform (GCP) |
| :--- | :--- | :--- | :--- |
| **Managed Kubernetes** | Azure Kubernetes Service (AKS) | Elastic Kubernetes Service (EKS) | Google Kubernetes Engine (GKE) |
| **Serverless Containers** | Azure Container Apps (ACA) | AWS ECS with Fargate | Google Cloud Run |
| **PaaS Web Hosting** | Azure App Service | AWS Elastic Beanstalk | Google App Engine / Cloud Run |
| **Serverless Functions** | Azure Functions | AWS Lambda | Google Cloud Functions |
| **Container Registry** | Azure Container Registry (ACR) | Elastic Container Registry (ECR) | Artifact Registry (GAR) |
| **In-Memory Cache** | Azure Cache for Redis | Amazon ElastiCache (Redis) | Memorystore for Redis |
| **Managed Relational DB** | PostgreSQL Flexible Server | Amazon RDS for PostgreSQL | Cloud SQL for PostgreSQL |
| **Private Connectivity** | Private Link & Private Endpoints | VPC Interface Endpoints | Private Service Connect / Peering |
| **Enterprise Identity SSO** | Microsoft Entra ID (App Reg) | AWS Cognito User Pools | Google Cloud Identity Platform |
| **Firewall & Security** | Azure Firewall / App Gateway | AWS Network Firewall / ALB | Cloud Armor / Cloud NAT |

---

## 🔒 DevOps & DevSecOps Strategy (Image Sync Pattern)

Rather than building container images directly in our target cloud environments (which requires exposing cloud registry credentials or executing docker-in-docker in multiple places), this repo implements the **GitLab-to-Cloud Mirroring Pattern**:

```mermaid
graph TD
    A[GitLab CI runner] -->|1. Build & Lint| B(Docker Image Build)
    B -->|2. Hadolint & Trivy Scan| C{Security Verification}
    C -->|Pass| D[GitLab Container Registry]
    C -->|Fail| E[Abort Build]
    D -->|3. Docker Pull by CI Runner| F[gitlab-runner environment]
    F -->|4. Authenticate & Copy| G[Target Cloud Registry<br>ACR / ECR / GAR]
    G -->|5. Private Network Pull| H[Compute Resources<br>AKS / EKS / GKE]
```

### Key Advantages:
1.  **Uniform Build & Scan Policy:** All images undergo vulnerabilities scanning (via Trivy) and linting in one unified GitLab runner stage.
2.  **Minimized Credentials Footprint:** Cloud credentials are only needed by the Sync job (or via OIDC) and are never exposed during the compilation or build processes.
3.  **Local Network Pulls:** AKS/EKS/GKE pull images from their local cloud registries via private endpoints, saving egress bandwidth cost and improving startup times.

---

## 🚀 Getting Started

1.  **Infrastructure Provisioning:**
    *   Navigate to your cloud of choice: e.g. `cd terraform/azure`
    *   Initialize: `terraform init`
    *   Configure workspace details in `terraform.tfvars`.
    *   Run: `terraform apply`
2.  **Configure GitLab CI/CD:**
    *   Commit this repo to GitLab.
    *   Configure GitLab variables for Cloud authentication (OIDC preferred). See details in `cicd/gitlab-ci/README.md`.
3.  **Deployment manifests:**
    *   Apply Kubernetes manifests: e.g. `kubectl apply -f manifests/azure/`

---

## 📦 Demo Application Execution
The monorepo contains a sample application under `/demo-app` verifying private cache and database configurations.

### Running Locally
To test the demo app locally:
1. Ensure you have Docker Compose or local instances of Postgres and Redis running.
2. In `demo-app/` create a `.env` file:
   ```text
   DATABASE_URL=postgresql://dbadmin:SuperSecretPassword123!@localhost:5432/postgres
   REDIS_URL=redis://127.0.0.1:6379
   CLOUD_PROVIDER=azure
   ENVIRONMENT=dev
   ```
3. Run `npm install` and `npm start`.
4. Open `http://localhost:8080` to see the live portal.

