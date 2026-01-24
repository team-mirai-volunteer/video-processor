# Project Configuration
variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "project_name" {
  description = "The project name used for resource naming"
  type        = string
  default     = "video-processor"
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "asia-northeast1"
}

# Networking Configuration
variable "subnet_cidr" {
  description = "The CIDR range for the main subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "connector_cidr" {
  description = "The CIDR range for the VPC Access Connector"
  type        = string
  default     = "10.8.0.0/28"
}

# Database Configuration
variable "database_tier" {
  description = "The machine type for Cloud SQL (db-f1-micro for dev, db-custom-2-4096 for prod)"
  type        = string
  default     = "db-custom-2-4096"
}

variable "database_availability_type" {
  description = "The availability type for Cloud SQL (ZONAL or REGIONAL)"
  type        = string
  default     = "REGIONAL"
}

variable "database_disk_size" {
  description = "The disk size in GB for Cloud SQL"
  type        = number
  default     = 20
}

variable "database_backup_enabled" {
  description = "Whether to enable automated backups for Cloud SQL"
  type        = bool
  default     = true
}

variable "database_deletion_protection" {
  description = "Whether to enable deletion protection for Cloud SQL"
  type        = bool
  default     = true
}

variable "database_name" {
  description = "The name of the database"
  type        = string
  default     = "video_processor"
}

variable "database_user" {
  description = "The database user name"
  type        = string
  default     = "app"
}

variable "database_password" {
  description = "The database user password"
  type        = string
  sensitive   = true
}

# Cloud Run Configuration
variable "container_image" {
  description = "The container image to deploy to Cloud Run"
  type        = string
}

variable "cloud_run_cpu" {
  description = "The CPU limit for Cloud Run"
  type        = string
  default     = "2"
}

variable "cloud_run_memory" {
  description = "The memory limit for Cloud Run"
  type        = string
  default     = "2Gi"
}

variable "cloud_run_timeout" {
  description = "The request timeout in seconds for Cloud Run"
  type        = number
  default     = 3600
}

variable "cloud_run_min_instances" {
  description = "The minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "The maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "cors_origin" {
  description = "The allowed CORS origin"
  type        = string
  default     = "https://video-processor.vercel.app"
}

variable "allow_unauthenticated" {
  description = "Whether to allow unauthenticated access to Cloud Run"
  type        = bool
  default     = false
}

# Google Drive Configuration
variable "google_drive_service_account_email" {
  description = "The service account email for Google Drive API access"
  type        = string
  default     = ""
}

variable "google_drive_output_folder_id" {
  description = "The Google Drive folder ID for output clips"
  type        = string
  default     = ""
}
