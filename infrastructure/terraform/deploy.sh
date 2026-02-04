#!/bin/bash
set -euo pipefail

# Usage: ./deploy.sh <env> <action>
# Examples:
#   ./deploy.sh stg plan
#   ./deploy.sh stg apply
#   ./deploy.sh prod plan
#   ./deploy.sh prod apply

ENV=${1:-stg}
ACTION=${2:-plan}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_DIR="${SCRIPT_DIR}/envs/${ENV}"

# Validate environment
if [[ ! -d "${ENV_DIR}" ]]; then
  echo "Error: Environment '${ENV}' not found at ${ENV_DIR}"
  echo "Available environments: stg, prod"
  exit 1
fi

# Validate action
case "${ACTION}" in
  init|plan|apply|destroy|output|fmt|validate|build|full)
    ;;
  *)
    echo "Error: Invalid action '${ACTION}'"
    echo "Valid actions: init, plan, apply, destroy, output, fmt, validate, build, full"
    exit 1
    ;;
esac

echo "=== Terraform ${ACTION} for ${ENV} environment ==="

# Set GCP variables based on environment
case "${ENV}" in
  stg)
    PROJECT_ID="mirai-video-processor"
    PROJECT_NAME="video-processor-stg"
    ;;
  prod)
    PROJECT_ID="mirai-video-processor"
    PROJECT_NAME="video-processor-prod"
    ;;
esac
REGION="asia-northeast1"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${PROJECT_NAME}"

# Function to build and push Docker images
build_images() {
  echo "=== Building Docker images ==="

  # Authenticate Docker to Artifact Registry
  echo "Authenticating Docker to Artifact Registry..."
  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

  # Build and push API image
  echo "Building API image..."
  docker build \
    --platform linux/amd64 \
    -f "${ROOT_DIR}/apps/backend/Dockerfile" \
    -t "${REGISTRY}/api:latest" \
    --target runner \
    "${ROOT_DIR}"

  echo "Pushing API image..."
  docker push "${REGISTRY}/api:latest"

  # Build and push migration image
  echo "Building migration image..."
  docker build \
    --platform linux/amd64 \
    -f "${ROOT_DIR}/apps/backend/Dockerfile" \
    -t "${REGISTRY}/migration:latest" \
    --target migrator \
    "${ROOT_DIR}"

  echo "Pushing migration image..."
  docker push "${REGISTRY}/migration:latest"

  echo "=== Docker images built and pushed ==="
}

# Handle build action early (doesn't need terraform)
if [[ "${ACTION}" == "build" ]]; then
  build_images
  echo "=== Done ==="
  exit 0
fi

# Load .env file if it exists
if [[ -f "${ENV_DIR}/.env" ]]; then
  echo "Loading environment variables from ${ENV_DIR}/.env"
  set -a
  # shellcheck disable=SC1091
  source "${ENV_DIR}/.env"
  set +a
else
  echo "Warning: No .env file found at ${ENV_DIR}/.env"
  echo "Make sure all required environment variables are set."
fi

# Generate tfvars from template using envsubst
if [[ -f "${ENV_DIR}/terraform.tfvars.tpl" ]]; then
  echo "Generating terraform.tfvars from template..."
  envsubst < "${ENV_DIR}/terraform.tfvars.tpl" > "${ENV_DIR}/terraform.tfvars"
else
  echo "Error: Template file not found at ${ENV_DIR}/terraform.tfvars.tpl"
  exit 1
fi

# Change to environment directory
cd "${ENV_DIR}"

# Backend config (shared backend.tf with dynamic prefix)
BACKEND_CONFIG="-backend-config=prefix=${ENV}"

# Run terraform
case "${ACTION}" in
  init)
    terraform init ${BACKEND_CONFIG}
    ;;
  plan)
    terraform init -upgrade ${BACKEND_CONFIG}
    terraform plan
    ;;
  apply)
    terraform init -upgrade ${BACKEND_CONFIG}
    if [[ "${ENV}" == "prod" ]]; then
      terraform apply
    else
      terraform apply -auto-approve
    fi
    ;;
  destroy)
    echo "Warning: This will destroy all resources in ${ENV} environment!"
    read -p "Are you sure? (yes/no): " confirm
    if [[ "${confirm}" == "yes" ]]; then
      terraform destroy
    else
      echo "Aborted."
      exit 0
    fi
    ;;
  output)
    terraform output
    ;;
  fmt)
    terraform fmt -recursive "${SCRIPT_DIR}"
    ;;
  validate)
    terraform init -backend=false
    terraform validate
    ;;
  full)
    # Build images first
    build_images

    # Then apply terraform
    terraform init -upgrade ${BACKEND_CONFIG}
    if [[ "${ENV}" == "prod" ]]; then
      terraform apply
    else
      terraform apply -auto-approve
    fi

    # Run database migration
    echo "=== Running database migration ==="
    gcloud run jobs execute "${PROJECT_NAME}-migration" \
      --region="${REGION}" \
      --project="${PROJECT_ID}" \
      --wait

    # Force Cloud Run to pull new image
    echo "=== Updating Cloud Run service to use new image ==="
    gcloud run services update "${PROJECT_NAME}-api" \
      --region="${REGION}" \
      --project="${PROJECT_ID}" \
      --image="${REGION}-docker.pkg.dev/${PROJECT_ID}/${PROJECT_NAME}/api:latest"
    ;;
esac

echo "=== Done ==="
