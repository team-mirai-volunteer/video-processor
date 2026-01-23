variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "enable_storage_access" {
  description = "Enable Cloud Storage access for Cloud Run service account"
  type        = bool
  default     = false
}

variable "create_sql_service_account" {
  description = "Create a separate service account for Cloud SQL"
  type        = bool
  default     = false
}

variable "cloud_run_service_name" {
  description = "Name of the Cloud Run service (for IAM bindings)"
  type        = string
  default     = ""
}

variable "allow_public_access" {
  description = "Allow public access to Cloud Run service"
  type        = bool
  default     = true
}
