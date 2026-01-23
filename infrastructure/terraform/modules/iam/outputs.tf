output "cloud_run_sa_email" {
  description = "Email of the Cloud Run service account"
  value       = google_service_account.cloud_run.email
}

output "cloud_run_sa_name" {
  description = "Name of the Cloud Run service account"
  value       = google_service_account.cloud_run.name
}

output "cloud_run_sa_unique_id" {
  description = "Unique ID of the Cloud Run service account"
  value       = google_service_account.cloud_run.unique_id
}
