# Backend configuration for remote state storage in GCS
# Uncomment and configure after creating the GCS bucket

# terraform {
#   backend "gcs" {
#     bucket = "video-processor-terraform-state"
#     prefix = "prod"
#   }
# }

# To create the backend bucket, run:
# gsutil mb -l asia-northeast1 gs://video-processor-terraform-state
# gsutil versioning set on gs://video-processor-terraform-state
