variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "cloud_run_sa_name" {
  description = "Service account name for Cloud Run"
  type        = string
}

variable "cloud_run_sa_display_name" {
  description = "Display name for the Cloud Run service account"
  type        = string
  default     = "Cloud Run Service Account"
}
