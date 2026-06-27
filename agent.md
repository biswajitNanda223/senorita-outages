# 🤖 Agent Coding Guidelines & Workspace Rules

This file defines the system rules, coding standards, and behavioral expectations for AI agents (like Antigravity) working within this repository. 

---

## 📌 Code Style & Structural Rules

### 1. Terraform IaC Standards
*   **Version Pinning:** Always pin provider versions using pessimistic operator `~>` (e.g. `version = "~> 5.30.0"`).
*   **Variables:** Every variable must contain a descriptive `description` block and a `type` constraint. Avoid untyped variables.
*   **Security Defaults:** 
    *   Public network ingress must be disabled by default (`public_network_access_enabled = false` or equivalent).
    *   Always place datastores (databases, caches) inside private subnets with no public IP allocation.
    *   Enable at-rest encryption and SSL/TLS transit enforcement for all databases and cache brokers.
*   **State Management:** Do not include local backend configuration overrides unless deploying to a sandbox environment.

### 2. GitLab CI/CD Standards
*   **Modular Templates:** Keep pipeline templates under `cicd/gitlab-ci/templates/` separated by function (building, IaC lifecycle, Kubernetes deployments).
*   **Scan Enforcement:** Any container build pipeline MUST execute Trivy scans and block the stage on high/critical failures.
*   **Credential hygiene:** Never write secrets or credentials in cleartext inside `.gitlab-ci.yml`. Always use project environment variables or OIDC federation.

### 3. Kubernetes Manifest Standards
*   **Namespacing:** All resources must declare an explicit namespace.
*   **Resources limits:** Declare cpu/memory `limits` and `requests` for all deployment pods.
*   **Security Context:** Configure containers to run as non-root users where possible.

---

## 📁 Repository Layout & File Locations

*   All documentation belongs in `docs/` or the root `README.md`.
*   All infrastructure code belongs in `terraform/<provider>/`.
*   All reusable pipeline steps go to `cicd/gitlab-ci/templates/`.
*   All deployment definitions go to `manifests/<provider>/`.
*   Scripts go to `cicd/scripts/` and must remain execution-compatible with Alpine/Ubuntu base images (POSIX compliant bash).

---

## 🔒 DevSecOps Safety Checklist
Before completing any task, agents must verify that:
1.  No API tokens, AWS Access Keys, or Service Account Keys have been committed in code.
2.  Private subnets do not route directly to an Internet Gateway (`igw`).
3.  Cross-VNet/VPC traffic is routed via Peering, Private Links, or Transit Gateways with active firewall route table mappings.
4.  Container sync scripts check exit codes of intermediate copy operations to prevent pushing partial layers.
