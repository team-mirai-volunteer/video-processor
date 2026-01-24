output "service_name" {
  description = "The name of the Cloud Run service"
  value       = google_cloud_run_v2_service.main.name
}

output "service_uri" {
  description = "The URI of the Cloud Run service"
  value       = google_cloud_run_v2_service.main.uri
}

output "service_id" {
  description = "The ID of the Cloud Run service"
  value       = google_cloud_run_v2_service.main.id
}
