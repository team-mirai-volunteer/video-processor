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

variable "network_id" {
  description = "VPC network ID for private IP"
  type        = string
}

variable "private_vpc_connection" {
  description = "Private VPC connection ID (dependency)"
  type        = string
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "tier" {
  description = "Machine tier (db-f1-micro for dev, db-custom-2-4096 for prod)"
  type        = string
  default     = "db-custom-2-4096"
}

variable "availability_type" {
  description = "Availability type (ZONAL or REGIONAL)"
  type        = string
  default     = "ZONAL"
}

variable "disk_size" {
  description = "Disk size in GB"
  type        = number
  default     = 20
}

variable "disk_type" {
  description = "Disk type (PD_SSD or PD_HDD)"
  type        = string
  default     = "PD_SSD"
}

variable "disk_autoresize" {
  description = "Enable disk autoresize"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "backup_enabled" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "backup_start_time" {
  description = "Backup start time (HH:MM format, UTC)"
  type        = string
  default     = "03:00"
}

variable "point_in_time_recovery_enabled" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = true
}

variable "transaction_log_retention_days" {
  description = "Number of days to retain transaction logs"
  type        = number
  default     = 7
}

variable "retained_backups" {
  description = "Number of backups to retain"
  type        = number
  default     = 7
}

variable "maintenance_window_day" {
  description = "Maintenance window day (1-7, 1 = Monday)"
  type        = number
  default     = 7
}

variable "maintenance_window_hour" {
  description = "Maintenance window hour (0-23, UTC)"
  type        = number
  default     = 4
}

variable "maintenance_update_track" {
  description = "Maintenance update track (stable, canary)"
  type        = string
  default     = "stable"
}

variable "query_insights_enabled" {
  description = "Enable query insights"
  type        = bool
  default     = true
}

variable "query_plans_per_minute" {
  description = "Number of query plans to capture per minute"
  type        = number
  default     = 5
}

variable "query_string_length" {
  description = "Maximum query string length"
  type        = number
  default     = 1024
}

variable "max_connections" {
  description = "Maximum number of connections"
  type        = string
  default     = "100"
}

variable "log_min_duration_statement" {
  description = "Minimum duration (ms) to log statements (-1 to disable)"
  type        = string
  default     = "1000"
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string
  default     = "video_processor"
}

variable "database_user" {
  description = "Database user name"
  type        = string
  default     = "app"
}

variable "database_password" {
  description = "Database user password"
  type        = string
  sensitive   = true
}
