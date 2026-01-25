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
ENV_DIR="${SCRIPT_DIR}/envs/${ENV}"

# Validate environment
if [[ ! -d "${ENV_DIR}" ]]; then
  echo "Error: Environment '${ENV}' not found at ${ENV_DIR}"
  echo "Available environments: stg, prod"
  exit 1
fi

# Validate action
case "${ACTION}" in
  init|plan|apply|destroy|output|fmt|validate)
    ;;
  *)
    echo "Error: Invalid action '${ACTION}'"
    echo "Valid actions: init, plan, apply, destroy, output, fmt, validate"
    exit 1
    ;;
esac

echo "=== Terraform ${ACTION} for ${ENV} environment ==="

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

# Run terraform
case "${ACTION}" in
  init)
    terraform init
    ;;
  plan)
    terraform init -upgrade
    terraform plan
    ;;
  apply)
    terraform init -upgrade
    terraform apply
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
esac

echo "=== Done ==="
