variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-northeast1"
}

variable "network_name" {
  description = "Name of the VPC network"
  type        = string
}

variable "subnet_name" {
  description = "Name of the subnet"
  type        = string
}

variable "subnet_cidr" {
  description = "CIDR range for the subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "connector_name" {
  description = "Name of the Serverless VPC Access Connector"
  type        = string
}

variable "connector_cidr" {
  description = "CIDR range for the VPC connector (must be /28)"
  type        = string
  default     = "10.8.0.0/28"
}

variable "connector_machine_type" {
  description = "Machine type for the VPC connector"
  type        = string
  default     = "e2-micro"
}

variable "connector_min_instances" {
  description = "Minimum number of instances for the VPC connector"
  type        = number
  default     = 2
}

variable "connector_max_instances" {
  description = "Maximum number of instances for the VPC connector"
  type        = number
  default     = 3
}
