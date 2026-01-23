output "instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "instance_connection_name" {
  description = "Cloud SQL instance connection name (project:region:instance)"
  value       = google_sql_database_instance.main.connection_name
}

output "instance_self_link" {
  description = "Cloud SQL instance self link"
  value       = google_sql_database_instance.main.self_link
}

output "private_ip_address" {
  description = "Private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.main.private_ip_address
}

output "database_name" {
  description = "Name of the database"
  value       = google_sql_database.main.name
}

output "database_user" {
  description = "Database user name"
  value       = google_sql_user.main.name
}

output "database_url" {
  description = "Database connection URL (without password)"
  value       = "postgresql://${google_sql_user.main.name}@/${google_sql_database.main.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
  sensitive   = true
}
