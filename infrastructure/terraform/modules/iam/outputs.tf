output "cloud_run_service_account_email" {
  description = "Email of the Cloud Run service account"
  value       = google_service_account.cloud_run.email
}

output "cloud_run_service_account_id" {
  description = "ID of the Cloud Run service account"
  value       = google_service_account.cloud_run.id
}

output "cloud_run_service_account_name" {
  description = "Name of the Cloud Run service account"
  value       = google_service_account.cloud_run.name
}

output "cloud_sql_service_account_email" {
  description = "Email of the Cloud SQL service account (if created)"
  value       = var.create_sql_service_account ? google_service_account.cloud_sql[0].email : null
}

output "cloud_sql_service_account_id" {
  description = "ID of the Cloud SQL service account (if created)"
  value       = var.create_sql_service_account ? google_service_account.cloud_sql[0].id : null
}
