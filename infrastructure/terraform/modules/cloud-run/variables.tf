variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-northeast1"
}

variable "container_image" {
  description = "Container image URL"
  type        = string
}

variable "migration_image" {
  description = "Migration container image URL"
  type        = string
}

variable "cpu" {
  description = "CPU limit"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit"
  type        = string
  default     = "1Gi"
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 2
}

variable "concurrency" {
  description = "Maximum concurrent requests per instance (must be 1 if cpu < 1)"
  type        = number
  default     = 80
}

variable "request_timeout" {
  description = "Request timeout in seconds"
  type        = number
  default     = 300
}

variable "allow_unauthenticated" {
  description = "Allow unauthenticated access"
  type        = bool
  default     = true
}

# VPC
variable "vpc_connector_id" {
  description = "VPC Access Connector ID"
  type        = string
}

# Database
variable "cloud_sql_connection_name" {
  description = "Cloud SQL connection name"
  type        = string
}

variable "database_name" {
  description = "Database name"
  type        = string
}

variable "database_user" {
  description = "Database user"
  type        = string
}

# Secrets
variable "openai_api_key_secret_id" {
  description = "Secret Manager secret ID for OpenAI API key"
  type        = string
}

variable "google_credentials_secret_id" {
  description = "Secret Manager secret ID for Google credentials"
  type        = string
}

variable "database_password_secret_id" {
  description = "Secret Manager secret ID for database password"
  type        = string
}

# Application config
variable "cors_origin" {
  description = "Allowed CORS origin"
  type        = string
}

variable "google_drive_output_folder_id" {
  description = "Google Drive output folder ID for clips"
  type        = string
}

variable "transcript_output_folder_id" {
  description = "Google Drive output folder ID for transcripts"
  type        = string
}

variable "service_account_email" {
  description = "Service account email for Cloud Run"
  type        = string
}
