variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
}

variable "google_credentials_json" {
  description = "Google service account credentials JSON"
  type        = string
  sensitive   = true
}

variable "cloud_run_service_account_email" {
  description = "Cloud Run service account email for IAM binding"
  type        = string
}

variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}
