# 💡 Gemini AI Prompting & Learning Guide

This document is an educational guide explaining how to instruct Gemini models to manage, extend, and troubleshoot this monorepo. It includes architectural visual flows, prompt blueprints, and debugging guidelines.

---

## 🔒 Azure SSO & App Registration Visual Flow

When setting up Azure Active Directory (Entra ID) Single Sign-On (SSO), it's easy to make mistakes. This flow diagram illustrates how Client ID, Client Secrets, and Tenants map across your infrastructure:

```mermaid
graph TD
    subgraph Client Application (Frontend)
        A[User Browser] -->|1. Request Login| B[Redirect to Auth Endpoint]
        B -->|Passes Client ID & scopes| C[Microsoft Entra ID Login Screen]
    end
    subgraph Entra ID Server
        C -->|2. Authenticate User| D[Generate Authorization Code]
        D -->|3. Redirect to App| E[Callback URL e.g. /login/oauth2/code/azure]
    end
    subgraph Backend Application
        E -->|4. Request Access Token| F[Token Endpoint]
        F -->|Passes Auth Code + Client ID + Client Secret| G[Validate & Return JWT Tokens]
        G -->|5. Session Established| H[Return Authenticated Session]
    end
```

### Prompt Template: Extending SSO config
Use this prompt if you want Gemini to write backend code to support the configured App Registration:
```text
Role: Cloud Security Specialist
Task: Write a Spring Boot Security / Node.js Express OAuth2 config matching the Terraform outputs in `terraform/azure/outputs.tf`.
Details:
- Bind client-id to the output `sso_client_id`.
- Bind client-secret to the output `sso_client_secret`.
- Configure endpoints to use redirect URIs matching `http://localhost:8080/login/oauth2/code/azure` for dev.
- Enforce PKCE for security.
```

---

## 🛠️ Prompt Blueprints for Gemini

Here are ready-to-copy prompts to instruct Gemini to write new features for this repo:

### 1. Adding a New Service to the VPC / Subnets
To add a new private resource (e.g. Azure Key Vault or AWS Secrets Manager) with private endpoints:
```text
Task: Add Azure Key Vault to our Terraform layout.
VPC Setup:
- Place it in the spoke VNet.
- Allocate a Private Endpoint in subnet `snet-private-endpoints`.
- Create a Private DNS Zone named `privatelink.vaultcore.azure.net`.
- Add virtual network link to the spoke VNet.
- Output the Vault URI.
Verify: Must not expose public network access (`public_network_access_enabled = false`).
```

### 2. Modifying GitLab CI/CD for a New microservice
To update the CI/CD pipeline to deploy a new microservice in the monorepo:
```text
Task: Extend `.gitlab-ci.yml` to support a new frontend application service.
Requirements:
- Add lint stage using Hadolint.
- Build image and push to GitLab registry.
- Scan image using Trivy.
- Sync image to target Azure ACR / AWS ECR using our `sync-registry.sh` script.
- Trigger deployment stage using Helm/kubectl in `manifests/`.
```

---

## 🔍 Troubleshooting Guide

### 1. Private DNS Resolution Failure (Compute can't resolve DB/Cache)
*   **Symptom:** Application containers throw `HostNotFound` or timeout when connecting to `postgres.database.azure.com` or `rds.amazonaws.com`.
*   **Resolution Prompt for Gemini:**
    ```text
    Symptom: My AKS pods cannot connect to the PostgreSQL flexible database and get DNS resolution timeouts.
    Checklist to verify:
    1. Is the Azure Private DNS Zone `privatelink.postgres.database.azure.com` linked to the Spoke VNet?
    2. Are the Pods using CoreDNS, and does CoreDNS forward queries to the Azure wire IP `168.63.129.16`?
    3. Is the private endpoint IP correctly registered in the DNS zone A-records?
    Fix the Terraform or manifest configuration to resolve this connection issue.
    ```

### 2. OIDC Role Trust Issues in AWS
*   **Symptom:** GitLab CI/CD jobs fail to authenticate against AWS ECR, throwing `AccessDenied: SignatureDoesNotMatch` or `AssumeRoleWithWebIdentity` failure.
*   **Resolution Prompt for Gemini:**
    ```text
    Symptom: GitLab CI runners cannot push to ECR using OIDC role assumption.
    Verify:
    1. Is the OpenID Connect Identity Provider for `gitlab.com` registered in IAM?
    2. Does the IAM role assume-role policy trust document include the correct aud (`https://gitlab.com`) and sub (`repo:group/project:ref_type:branch:ref:main`) conditions?
    Review `terraform/aws/main.tf` and suggest the corrected IAM Trust policy.
    ```
