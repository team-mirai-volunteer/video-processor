output "service_name" {
  description = "Cloud Run service name"
  value       = google_cloud_run_v2_service.main.name
}

output "service_id" {
  description = "Cloud Run service ID"
  value       = google_cloud_run_v2_service.main.id
}

output "service_uri" {
  description = "Cloud Run service URI"
  value       = google_cloud_run_v2_service.main.uri
}

output "service_location" {
  description = "Cloud Run service location"
  value       = google_cloud_run_v2_service.main.location
}

output "latest_revision" {
  description = "Latest revision name"
  value       = google_cloud_run_v2_service.main.latest_ready_revision
}

output "custom_domain_status" {
  description = "Custom domain mapping status (if configured)"
  value       = var.custom_domain != "" ? google_cloud_run_domain_mapping.main[0].status : null
}
