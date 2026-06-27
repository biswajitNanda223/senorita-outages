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
      echo "❌ [LINT ERROR] Babuji ne kaha Dockerfile chhod do, par hadolint ne kaha secure rules chhod do! Check failed in $dockerfile!"
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
    echo "❌ [FORMAT ERROR] Merge conflicts se darr nahi lagta sahab, unformatted Terraform state se lagta hai! Run 'terraform fmt -recursive' to fix."
    EXIT_CODE=1
  fi
else
  echo "⚠️ terraform CLI not installed. Skipping format checks."
fi

# 3. Kubernetes manifests syntax check
if command -v kubectl &> /dev/null; then
  echo "☸️ Dry-running Kubernetes manifests..."
  while IFS= read -r manifest; do
    if ! kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
      echo "❌ [MANIFEST ERROR] Ek missing space YAML compiler block kar deta hai! Validation failed for $manifest!"
      EXIT_CODE=1
    fi
  done < <(find manifests/ -name "*.yaml" -o -name "*.yml")
else
  echo "⚠️ kubectl CLI not installed. Skipping manifest dry-run checks."
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo "========================================="
  echo "💃 MOGAMBO KHUSH HUA! All checks passed!"
  echo "👉 Ja Simran ja, commit kar de apni branch mein!"
  echo "========================================="
else
  echo "========================================="
  echo "😡 MOGAMBO NA-KHUSH HUA! Validation failed!"
  echo "👉 Don ko pakadna mushkil hi nahi, namumkin hai... aur is commit ko push karna usse bhi mushkil jab tak validation errors fix nahi hote!"
  echo "========================================="
fi

exit $EXIT_CODE
