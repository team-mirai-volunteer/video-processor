variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "project_name" {
  description = "The project name used for resource naming"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "asia-northeast1"
}

variable "container_image" {
  description = "The container image to deploy"
  type        = string
}

variable "container_port" {
  description = "The port the container listens on"
  type        = number
  default     = 8080
}

variable "service_account_email" {
  description = "The service account email for Cloud Run"
  type        = string
}

variable "vpc_connector_id" {
  description = "The VPC Access Connector ID"
  type        = string
}

variable "cloud_sql_connection_name" {
  description = "The Cloud SQL instance connection name"
  type        = string
}

variable "cpu" {
  description = "The CPU limit for the container"
  type        = string
  default     = "2"
}

variable "memory" {
  description = "The memory limit for the container"
  type        = string
  default     = "2Gi"
}

variable "timeout_seconds" {
  description = "The request timeout in seconds"
  type        = number
  default     = 3600
}

variable "min_instances" {
  description = "The minimum number of instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "The maximum number of instances"
  type        = number
  default     = 10
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "secret_environment_variables" {
  description = "Secret environment variables for the container"
  type = map(object({
    secret_id = string
    version   = string
  }))
  default = {}
}

variable "allow_unauthenticated" {
  description = "Whether to allow unauthenticated access"
  type        = bool
  default     = false
}
