output "cloud_run_url" {
  description = "URL of the Cloud Run service"
  value       = module.cloud_run.service_url
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name (project:region:instance)"
  value       = module.cloud_sql.connection_name
}

output "service_account_email" {
  description = "Email of the Cloud Run service account"
  value       = module.iam.cloud_run_sa_email
}

output "vpc_name" {
  description = "Name of the VPC network"
  value       = module.networking.vpc_name
}

output "vpc_connector_name" {
  description = "Name of the VPC connector"
  value       = module.networking.vpc_connector_name
}

output "cloud_sql_private_ip" {
  description = "Private IP address of Cloud SQL instance"
  value       = module.cloud_sql.private_ip_address
}

output "database_name" {
  description = "Name of the database"
  value       = module.cloud_sql.database_name
}
