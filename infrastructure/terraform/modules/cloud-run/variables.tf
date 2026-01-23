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

variable "container_image" {
  description = "Container image URL"
  type        = string
}

variable "service_account_email" {
  description = "Service account email for Cloud Run"
  type        = string
}

variable "vpc_connector_id" {
  description = "VPC connector ID for Serverless VPC Access"
  type        = string
}

variable "vpc_egress" {
  description = "VPC egress setting (ALL_TRAFFIC or PRIVATE_RANGES_ONLY)"
  type        = string
  default     = "PRIVATE_RANGES_ONLY"
}

variable "cloud_sql_connection_name" {
  description = "Cloud SQL instance connection name"
  type        = string
}

variable "ingress" {
  description = "Ingress setting (INGRESS_TRAFFIC_ALL, INGRESS_TRAFFIC_INTERNAL_ONLY, INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER)"
  type        = string
  default     = "INGRESS_TRAFFIC_ALL"
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 10
}

variable "cpu" {
  description = "CPU allocation"
  type        = string
  default     = "2"
}

variable "memory" {
  description = "Memory allocation"
  type        = string
  default     = "2Gi"
}

variable "cpu_idle" {
  description = "Whether CPU should be throttled when no requests are being handled"
  type        = bool
  default     = true
}

variable "startup_cpu_boost" {
  description = "Enable CPU boost during startup"
  type        = bool
  default     = true
}

variable "timeout_seconds" {
  description = "Request timeout in seconds (max 3600)"
  type        = number
  default     = 3600
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 8080
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "secret_environment_variables" {
  description = "Secret environment variables for the container"
  type = map(object({
    name      = string
    secret_id = string
    version   = string
  }))
  default = {}
}

variable "allow_public_access" {
  description = "Allow public access to the service"
  type        = bool
  default     = true
}

variable "custom_domain" {
  description = "Custom domain for the service (optional)"
  type        = string
  default     = ""
}

variable "health_check_path" {
  description = "Path for health check endpoint"
  type        = string
  default     = "/health"
}

variable "startup_probe_initial_delay" {
  description = "Initial delay for startup probe in seconds"
  type        = number
  default     = 0
}

variable "startup_probe_timeout" {
  description = "Timeout for startup probe in seconds"
  type        = number
  default     = 5
}

variable "startup_probe_period" {
  description = "Period for startup probe in seconds"
  type        = number
  default     = 10
}

variable "startup_probe_failure_threshold" {
  description = "Failure threshold for startup probe"
  type        = number
  default     = 3
}

variable "liveness_probe_initial_delay" {
  description = "Initial delay for liveness probe in seconds"
  type        = number
  default     = 0
}

variable "liveness_probe_timeout" {
  description = "Timeout for liveness probe in seconds"
  type        = number
  default     = 5
}

variable "liveness_probe_period" {
  description = "Period for liveness probe in seconds"
  type        = number
  default     = 30
}

variable "liveness_probe_failure_threshold" {
  description = "Failure threshold for liveness probe"
  type        = number
  default     = 3
}
