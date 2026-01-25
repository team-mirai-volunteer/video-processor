variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "video-processor-prod"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-northeast1"
}

# Database
variable "database_password" {
  description = "Database user password"
  type        = string
  sensitive   = true
}

# Secrets
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

# Application
variable "container_image" {
  description = "Container image URL"
  type        = string
}

variable "cors_origin" {
  description = "Allowed CORS origin"
  type        = string
}

variable "google_drive_output_folder_id" {
  description = "Google Drive output folder ID"
  type        = string
}
