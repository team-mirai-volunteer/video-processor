# Terraform Backend Configuration
# This file configures remote state storage in Google Cloud Storage
#
# Before applying, create the GCS bucket:
#   gsutil mb -p YOUR_PROJECT_ID -l asia-northeast1 gs://YOUR_PROJECT_ID-terraform-state
#   gsutil versioning set on gs://YOUR_PROJECT_ID-terraform-state

terraform {
  backend "gcs" {
    bucket = "video-processor-terraform-state"
    prefix = "terraform/state/prod"
  }
}

# Note: To use this backend configuration:
# 1. Create the GCS bucket manually or via the following commands:
#    gcloud storage buckets create gs://${PROJECT_ID}-terraform-state \
#      --project=${PROJECT_ID} \
#      --location=asia-northeast1 \
#      --uniform-bucket-level-access
#
# 2. Enable versioning for state file protection:
#    gcloud storage buckets update gs://${PROJECT_ID}-terraform-state \
#      --versioning
#
# 3. Update the bucket name in this file to match your project
#
# 4. Initialize Terraform:
#    terraform init
