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
