# Cloud Run Outputs
output "cloud_run_service_uri" {
  description = "The URI of the Cloud Run service"
  value       = module.cloud_run.service_uri
}

output "cloud_run_service_name" {
  description = "The name of the Cloud Run service"
  value       = module.cloud_run.service_name
}

# Cloud SQL Outputs
output "cloud_sql_instance_connection_name" {
  description = "The connection name for Cloud SQL"
  value       = module.cloud_sql.instance_connection_name
}

output "cloud_sql_private_ip" {
  description = "The private IP address of Cloud SQL"
  value       = module.cloud_sql.private_ip_address
}

# Networking Outputs
output "vpc_network_name" {
  description = "The name of the VPC network"
  value       = module.networking.network_name
}

output "vpc_connector_name" {
  description = "The name of the VPC Access Connector"
  value       = module.networking.vpc_connector_name
}

# IAM Outputs
output "cloud_run_service_account_email" {
  description = "The email of the Cloud Run service account"
  value       = module.iam.cloud_run_service_account_email
}
