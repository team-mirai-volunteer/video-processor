# =============================================================================
# Cloud Run Outputs
# =============================================================================

output "cloud_run_service_name" {
  description = "Cloud Run service name"
  value       = module.cloud_run.service_name
}

output "cloud_run_service_uri" {
  description = "Cloud Run service URI"
  value       = module.cloud_run.service_uri
}

output "cloud_run_latest_revision" {
  description = "Cloud Run latest revision"
  value       = module.cloud_run.latest_revision
}

# =============================================================================
# Cloud SQL Outputs
# =============================================================================

output "cloud_sql_instance_name" {
  description = "Cloud SQL instance name"
  value       = module.cloud_sql.instance_name
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name"
  value       = module.cloud_sql.instance_connection_name
}

output "cloud_sql_private_ip" {
  description = "Cloud SQL private IP address"
  value       = module.cloud_sql.private_ip_address
}

output "database_name" {
  description = "Database name"
  value       = module.cloud_sql.database_name
}

output "database_user" {
  description = "Database user"
  value       = module.cloud_sql.database_user
}

# =============================================================================
# Networking Outputs
# =============================================================================

output "vpc_network_name" {
  description = "VPC network name"
  value       = module.networking.network_name
}

output "subnet_name" {
  description = "Subnet name"
  value       = module.networking.subnet_name
}

output "vpc_connector_name" {
  description = "VPC connector name"
  value       = module.networking.vpc_connector_name
}

output "nat_name" {
  description = "Cloud NAT name"
  value       = module.networking.nat_name
}

# =============================================================================
# IAM Outputs
# =============================================================================

output "cloud_run_service_account_email" {
  description = "Cloud Run service account email"
  value       = module.iam.cloud_run_service_account_email
}

# =============================================================================
# Secret Manager Outputs
# =============================================================================

output "database_password_secret_id" {
  description = "Secret Manager secret ID for database password"
  value       = google_secret_manager_secret.database_password.secret_id
}
