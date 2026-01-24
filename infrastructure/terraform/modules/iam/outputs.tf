output "cloud_run_service_account_email" {
  description = "The email of the Cloud Run service account"
  value       = google_service_account.cloud_run.email
}

output "cloud_run_service_account_id" {
  description = "The ID of the Cloud Run service account"
  value       = google_service_account.cloud_run.id
}

output "cloud_run_service_account_name" {
  description = "The fully qualified name of the Cloud Run service account"
  value       = google_service_account.cloud_run.name
}
