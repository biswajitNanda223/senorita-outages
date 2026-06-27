#!/usr/bin/env bash
# sync-registry.sh
# Safely copies container images from GitLab Container Registry to Cloud Registries (ACR, ECR, GAR)
# Uses 'skopeo' if available for daemonless transfer; otherwise falls back to docker pull/tag/push.

set -euo pipefail

if [ "$#" -lt 3 ]; then
    echo "Usage: $0 <gitlab_image> <cloud_image> <provider>"
    echo "Providers: azure | aws | gcp"
    exit 1
fi

GITLAB_IMAGE=$1
CLOUD_IMAGE=$2
PROVIDER=$3

echo "=== Registry Sync Tool ==="
echo "GitLab Source: $GITLAB_IMAGE"
echo "Cloud Target : $CLOUD_IMAGE"
echo "Provider     : $PROVIDER"
echo "=========================="

# Helper function: Check command availability
has_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Perform provider-specific login credentials resolution
cloud_login() {
    case "$PROVIDER" in
        azure)
            echo "Logging into Azure ACR..."
            # Expecting AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_REGISTRY_SERVER
            if [ -n "${AZURE_CLIENT_ID:-}" ] && [ -n "${AZURE_CLIENT_SECRET:-}" ]; then
                if has_cmd az; then
                    az login --service-principal -u "$AZURE_CLIENT_ID" -p "$AZURE_CLIENT_SECRET" --tenant "$AZURE_TENANT_ID" >/dev/null
                    az acr login --name "$(echo "$CLOUD_IMAGE" | cut -d'/' -f1)"
                elif has_cmd docker; then
                    # Fallback to direct token login
                    echo "$AZURE_CLIENT_SECRET" | docker login "$(echo "$CLOUD_IMAGE" | cut -d'/' -f1)" -u "$AZURE_CLIENT_ID" --password-stdin
                fi
            else
                echo "Warning: Azure credentials not found. Assuming already authenticated."
            fi
            ;;
        aws)
            echo "Logging into AWS ECR..."
            # Expecting AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
            if has_cmd aws; then
                aws ecr get-login-password --region "${AWS_DEFAULT_REGION:-us-east-1}" | \
                    docker login --username AWS --password-stdin "$(echo "$CLOUD_IMAGE" | cut -d'/' -f1)"
            else
                echo "Error: AWS CLI required for ECR login."
                exit 1
            fi
            ;;
        gcp)
            echo "Logging into GCP Artifact Registry..."
            # Expecting GCP_SERVICE_KEY (JSON string) or active Application Default Credentials
            if [ -n "${GCP_SERVICE_KEY:-}" ]; then
                if has_cmd gcloud; then
                    echo "$GCP_SERVICE_KEY" > /tmp/gcp_key.json
                    gcloud auth activate-service-account --key-file=/tmp/gcp_key.json
                    gcloud auth configure-docker "$(echo "$CLOUD_IMAGE" | cut -d'/' -f1)" --quiet
                elif has_cmd docker; then
                    echo "$GCP_SERVICE_KEY" | docker login -u _json_key --password-stdin "https://$(echo "$CLOUD_IMAGE" | cut -d'/' -f1)"
                fi
            else
                echo "Warning: GCP credentials not found. Assuming already authenticated."
            fi
            ;;
        *)
            echo "Error: Unsupported cloud provider: $PROVIDER"
            exit 1
            ;;
    esac
}

# Run sync process
if has_cmd skopeo; then
    echo "Detected 'skopeo'. Performing secure daemonless copy..."
    # Skopeo uses local credentials files if available, otherwise pass explicitly
    skopeo copy --all \
        --src-creds "${CI_REGISTRY_USER}:${CI_REGISTRY_PASSWORD}" \
        "docker://${GITLAB_IMAGE}" \
        "docker://${CLOUD_IMAGE}"
else
    echo "Skopeo not found. Falling back to Docker daemon logic..."
    if ! has_cmd docker; then
        echo "Error: Neither skopeo nor docker is available in this runner."
        exit 1
    fi
    
    # 1. Login to GitLab Registry
    echo "$CI_REGISTRY_PASSWORD" | docker login "$CI_REGISTRY" -u "$CI_REGISTRY_USER" --password-stdin
    
    # 2. Pull
    docker pull "$GITLAB_IMAGE"
    
    # 3. Log into Cloud Registry
    cloud_login
    
    # 4. Tag & Push
    docker tag "$GITLAB_IMAGE" "$CLOUD_IMAGE"
    docker push "$CLOUD_IMAGE"
    
    # Clean up local image cache
    docker rmi "$GITLAB_IMAGE" "$CLOUD_IMAGE" || true
fi

echo "Image successfully synchronized to cloud registry!"
