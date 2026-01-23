# =============================================================================
# Project Configuration
# =============================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "video-processor"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# =============================================================================
# Networking Configuration
# =============================================================================

variable "subnet_cidr" {
  description = "CIDR range for the main subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "connector_cidr" {
  description = "CIDR range for the VPC connector (must be /28)"
  type        = string
  default     = "10.8.0.0/28"
}

variable "connector_min_instances" {
  description = "Minimum number of instances for VPC connector"
  type        = number
  default     = 2
}

variable "connector_max_instances" {
  description = "Maximum number of instances for VPC connector"
  type        = number
  default     = 10
}

variable "vpc_egress" {
  description = "VPC egress setting for Cloud Run"
  type        = string
  default     = "PRIVATE_RANGES_ONLY"
}

# =============================================================================
# Database Configuration
# =============================================================================

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "database_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-custom-2-4096"
}

variable "database_availability_type" {
  description = "Cloud SQL availability type (ZONAL or REGIONAL)"
  type        = string
  default     = "ZONAL"
}

variable "database_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 20
}

variable "database_disk_type" {
  description = "Cloud SQL disk type"
  type        = string
  default     = "PD_SSD"
}

variable "database_disk_autoresize" {
  description = "Enable Cloud SQL disk autoresize"
  type        = bool
  default     = true
}

variable "database_deletion_protection" {
  description = "Enable Cloud SQL deletion protection"
  type        = bool
  default     = true
}

variable "database_backup_enabled" {
  description = "Enable Cloud SQL automated backups"
  type        = bool
  default     = true
}

variable "database_point_in_time_recovery_enabled" {
  description = "Enable Cloud SQL point-in-time recovery"
  type        = bool
  default     = true
}

variable "database_retained_backups" {
  description = "Number of Cloud SQL backups to retain"
  type        = number
  default     = 7
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "video_processor"
}

variable "database_user" {
  description = "Database user name"
  type        = string
  default     = "app"
}

variable "database_max_connections" {
  description = "Maximum database connections"
  type        = string
  default     = "100"
}

variable "database_log_min_duration_statement" {
  description = "Minimum duration (ms) to log SQL statements"
  type        = string
  default     = "1000"
}

# =============================================================================
# Cloud Run Configuration
# =============================================================================

variable "container_image" {
  description = "Container image URL for Cloud Run"
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

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
  description = "Cloud Run CPU allocation"
  type        = string
  default     = "2"
}

variable "cloud_run_memory" {
  description = "Cloud Run memory allocation"
  type        = string
  default     = "2Gi"
}

variable "cloud_run_timeout_seconds" {
  description = "Cloud Run request timeout in seconds"
  type        = number
  default     = 3600
}

variable "cloud_run_container_port" {
  description = "Cloud Run container port"
  type        = number
  default     = 8080
}

variable "health_check_path" {
  description = "Health check endpoint path"
  type        = string
  default     = "/health"
}

variable "additional_environment_variables" {
  description = "Additional environment variables for Cloud Run"
  type        = map(string)
  default     = {}
}

# =============================================================================
# IAM Configuration
# =============================================================================

variable "enable_storage_access" {
  description = "Enable Cloud Storage access for Cloud Run service account"
  type        = bool
  default     = false
}

variable "allow_public_access" {
  description = "Allow public access to Cloud Run service"
  type        = bool
  default     = true
}
