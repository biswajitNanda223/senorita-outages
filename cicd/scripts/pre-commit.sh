#!/usr/bin/env bash
# cicd/scripts/pre-commit.sh
# Git pre-commit hook script to validate Dockerfiles, Terraform, and K8s manifests formatting

echo "========================================="
echo "🚀 Running Pre-Commit Code Validation..."
echo "========================================="

EXIT_CODE=0

# 1. Hadolint Dockerfile check
if command -v hadolint &> /dev/null; then
  echo "🐳 Linting Dockerfiles..."
  while IFS= read -r dockerfile; do
    echo "Checking $dockerfile..."
    if ! hadolint "$dockerfile"; then
      echo "❌ Lint errors found in $dockerfile!"
      EXIT_CODE=1
    fi
  done < <(find . -name "Dockerfile" -not -path "*/node_modules/*")
else
  echo "⚠️ hadolint not installed. Skipping Dockerfile lint checks."
fi

# 2. Terraform format check
if command -v terraform &> /dev/null; then
  echo "🏗️ Checking Terraform format..."
  if ! terraform fmt -recursive -check; then
    echo "❌ Terraform files are not formatted! Run 'terraform fmt -recursive' to fix."
    EXIT_CODE=1
  fi
else
  echo "⚠️ terraform CLI not installed. Skipping format checks."
fi

# 3. Kubernetes manifests syntax check (using kubectl dry-run if available, or basic YAML checks)
if command -v kubectl &> /dev/null; then
  echo "☸️ Dry-running Kubernetes manifests..."
  while IFS= read -r manifest; do
    # Only test if a config is contextually loaded
    if ! kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
      echo "❌ Kubernetes manifest validation failed for $manifest!"
      EXIT_CODE=1
    fi
  done < <(find manifests/ -name "*.yaml" -o -name "*.yml")
else
  echo "⚠️ kubectl CLI not installed. Skipping manifest dry-run checks."
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All pre-commit checks passed successfully!"
else
  echo "❌ Pre-commit checks failed. Please fix the errors before committing."
fi

exit $EXIT_CODE
