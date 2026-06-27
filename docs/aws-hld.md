# 🎬 High-Level Design: Amazon Web Services (AWS) Infrastructure
## *MasalaOps Presents: "The Multi-AZ Survival Adventure!"*

> [!NOTE]
> **Director's Note:** In this action-packed thriller, our compute nodes (EKS & ECS Fargate) are replicated across multiple Availability Zones. If a meteor (or a rogue script) strikes Zone A, the show goes on in Zone B and C without missing a single beat!

This document outlines the architecture, networking, security policies, and application hosting strategy for the AWS deployment.

---

## 📐 Architecture Visualisation

Below is the conceptual architecture blueprint for our AWS VPC deployment.

![AWS Architecture](images/aws_architecture.png)

---

## 🌐 Network & Resource Isolation

We implement a multi-AZ VPC layout spanning two Availability Zones (AZs) for high availability, isolating workloads using public and private subnets.

```mermaid
graph TD
    subgraph VPC
        ALB[Application Load Balancer] -->|Ingress| NFW[AWS Network Firewall]
        NFW -->|Filtered Ingress| EKS[EKS Subnet Private]
        NFW -->|Filtered Ingress| ECS[ECS Fargate Subnet Private]
        EKS & ECS -->|Private Connection| PE[VPC Interface Endpoints]
    end
    PE -->|Private Link| ECR[Amazon ECR]
    PE -->|Private Link| SM[Secrets Manager]
    PE -->|Private Link| Redis[Amazon ElastiCache Redis]
    PE -->|Private Link| DB[Amazon RDS PostgreSQL]
```

### 1. Subnet Segmentation
*   **Public Subnets (AZ1 & AZ2):** Hosts Internet Gateways, NAT Gateways, and public ALB nodes.
*   **Private Application Subnets (AZ1 & AZ2):** Hosts Elastic Kubernetes Service (EKS) workers, Amazon ECS Fargate tasks, and app instances. No direct public ingress.
*   **Private Database Subnets (AZ1 & AZ2):** Contains RDS PostgreSQL multi-AZ deployment and Amazon ElastiCache Redis nodes.
*   **Transit Gateway / Firewall Subnets:** Dedicated subnets route egress traffic through AWS Network Firewall for domain filtering.

### 2. VPC Interface Endpoints (AWS PrivateLink)
Backend services are isolated from the internet. Private communication is routed inside the VPC using interface endpoints:
*   `com.amazonaws.<region>.ecr.api` & `com.amazonaws.<region>.ecr.dkr` for ECR.
*   `com.amazonaws.<region>.secretsmanager` for secrets storage.
*   `com.amazonaws.<region>.rds` for RDS APIs.

---

## 🔐 SSO: AWS Cognito User Pools

SSO is managed through AWS Cognito. Applications exchange codes for JWT tokens over standard OIDC protocols.

### 1. App Client Settings
*   **UserPool ID:** The unique user pool identifier (e.g., `us-east-1_xxxxxxxxx`).
*   **App Client ID:** App-specific identifier.
*   **Client Secret:** Used for server-side auth validation.
*   **Callback URLs:**
    *   Development: `http://localhost:8080/login/oauth2/code/cognito`
    *   Production: `https://app.example.com/login/oauth2/code/cognito`
*   **Allowed OAuth Flows:** Authorization Code Grant, PKCE.
*   **Allowed OAuth Scopes:** `openid`, `profile`, `email`, `aws.cognito.signin.user.admin`.

### 2. OIDC Flow Integration
Cognito acts as the Identity Provider (IdP). The application parses the JWT tokens (`id_token`, `access_token`) to authenticate the request and map group memberships to IAM roles via AWS Security Token Service (STS).

---

## 🛠️ Compute Use-Cases

1.  **Amazon EKS (Elastic Kubernetes Service):**
    *   *Use Case:* Large-scale microservice platforms requiring fine-grained network policies (Calico), autoscaling based on custom metrics (KEDA/Prometheus), or customized ingress/routing configurations.
    *   *IAM Integration:* IAM Roles for Service Accounts (IRSA) maps AWS IAM credentials to specific K8s service accounts.
2.  **Amazon ECS on AWS Fargate:**
    *   *Use Case:* Serverless containerized APIs and scheduled cron jobs. Fargate manages the underlying OS patching and VM provisioning.
3.  **AWS Lambda:**
    *   *Use Case:* Serverless, event-driven computing triggered by S3 bucket events, SQS queues, or DynamoDB streams. Runs attached to the target private subnet to reach backend DBs.

---

## 📦 Demo Application Deployment Flow
Here is how our containerized demo application (Node.js/Express) runs and communicates inside our private AWS VPC:

![Demo Deployment Flow](images/demo_deployment_flow.png)

1. **Ingress Entry:** Incoming traffic passes the Application Load Balancer (ALB) and AWS Network Firewall.
2. **Compute Target:** App runs inside EKS pods or ECS Fargate tasks inside private app subnets.
3. **SSO Hook:** Authenticates users via AWS Cognito User Pools redirection.
4. **Data Cache:** Connects to Amazon ElastiCache Redis replication group via private VPC endpoints.
5. **Data Storage:** Reads/Writes items to Amazon RDS PostgreSQL multi-AZ instance.

---

## 💾 5. Amazon CloudWatch Logs & Retention Policies

System logs from EC2 nodes and stdout/stderr logs from EKS container workloads are shipped directly to **Amazon CloudWatch Logs** to ensure central audit compliance.

```mermaid
graph TD
    App[Fastify App Pods] -->|Stdout Container Logs| FB[Fluent Bit DaemonSet]
    FB -->|1. Ingest Log Streams| CW[Amazon CloudWatch Log Groups]
    CW -->|2. Lifecycle Rule| S3[Glacier Archival Storage]
    CW -->|3. Threat Auditing| GuardDuty[Amazon GuardDuty / SIEM]
```

### 1. Log Shipping with Fluent Bit
*   **DaemonSet Deployment:** Fluent Bit runs on EKS worker nodes, reads log sockets at `/var/log/containers/*`, decorates them with Kubernetes metadata, and sends them to CloudWatch Logs APIs.

### 2. Cost-Optimized Log Retention
By default, CloudWatch Log Groups store logs indefinitely, leading to massive storage costs. We enforce retention limits in Terraform:
```terraform
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/aws/eks/enterprise-cluster/app-backend"
  retention_in_days = 30 # Automatically purges logs older than 30 days
}
```

---

## 📊 6. Monitoring with Amazon Managed Prometheus (AMP) & Grafana (AMG)

For high-scale container monitoring, AWS provides managed integrations for Prometheus and Grafana.

![AWS Observability Logging & Metrics Pipeline](images/aws_observability_pipeline.png)

```mermaid
graph TD
    Pod[EKS Application Pods] -->|Exposes /metrics| Endpoint[Pod IP Metrics]
    ADOT[AWS Distro for OpenTelemetry] -->|1. Scrapes metrics periodically| Endpoint
    ADOT -->|2. Ingests data using IAM SigV4| AMP[Amazon Managed Prometheus Workspace]
    AMG[Amazon Managed Grafana] -->|3. Query Metrics via PromQL| AMP
    User[Operations Team] -->|4. Monitors Dashboards| AMG
```

### 1. Amazon Managed Service for Prometheus (AMP)
*   **Ingestion:** The **AWS Distro for OpenTelemetry (ADOT)** collector runs in the EKS cluster, scrapes Prometheus metrics from pods, and pushes them to AMP using **AWS Signature Version 4 (SigV4)** signing for secure identity checks.
*   **Scale:** AMP automatically scales querying and storage boundaries as cluster pods expand.

### 2. Amazon Managed Grafana (AMG)
*   **Identity Sync:** AMG integrates with **AWS IAM Identity Center** (formerly SSO) to manage administrator and viewer logins.
*   **Secret Connection:** AMG uses IAM role assumption to read metrics from AMP workspaces privately without any static passwords.


