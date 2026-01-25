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

variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
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

# Application config
variable "cors_origin" {
  description = "Allowed CORS origin"
  type        = string
}

variable "google_drive_output_folder_id" {
  description = "Google Drive output folder ID"
  type        = string
}
