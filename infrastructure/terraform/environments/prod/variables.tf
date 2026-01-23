variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "Environment name (prod/dev)"
  type        = string
  default     = "prod"
}

# Cloud Run
variable "cloud_run_image" {
  description = "Container image URL for Cloud Run"
  type        = string
}

# Database
variable "database_password" {
  description = "Password for the database user"
  type        = string
  sensitive   = true
}

# Optional overrides
variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run"
  type        = string
  default     = "2"
}

variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run"
  type        = string
  default     = "2Gi"
}

variable "cloud_sql_machine_type" {
  description = "Machine type for Cloud SQL"
  type        = string
  default     = "db-custom-2-4096"
}

variable "cloud_sql_deletion_protection" {
  description = "Enable deletion protection for Cloud SQL"
  type        = bool
  default     = true
}

variable "frontend_url" {
  description = "Frontend URL for CORS configuration"
  type        = string
  default     = "https://video-processor.vercel.app"
}
