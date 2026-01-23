# Cloud SQL PostgreSQL Instance
resource "google_sql_database_instance" "main" {
  name             = "${var.project_name}-db-${var.environment}"
  project          = var.project_id
  region           = var.region
  database_version = var.database_version

  deletion_protection = var.deletion_protection

  settings {
    tier              = var.tier
    availability_type = var.availability_type
    disk_size         = var.disk_size
    disk_type         = var.disk_type
    disk_autoresize   = var.disk_autoresize

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.network_id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled                        = var.backup_enabled
      start_time                     = var.backup_start_time
      point_in_time_recovery_enabled = var.point_in_time_recovery_enabled
      transaction_log_retention_days = var.transaction_log_retention_days

      backup_retention_settings {
        retained_backups = var.retained_backups
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = var.maintenance_window_day
      hour         = var.maintenance_window_hour
      update_track = var.maintenance_update_track
    }

    insights_config {
      query_insights_enabled  = var.query_insights_enabled
      query_plans_per_minute  = var.query_plans_per_minute
      query_string_length     = var.query_string_length
      record_application_tags = true
      record_client_address   = true
    }

    database_flags {
      name  = "max_connections"
      value = var.max_connections
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = var.log_min_duration_statement
    }

    user_labels = {
      environment = var.environment
      project     = var.project_name
      managed_by  = "terraform"
    }
  }

  depends_on = [var.private_vpc_connection]
}

# Database
resource "google_sql_database" "main" {
  name     = var.database_name
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  charset  = "UTF8"
}

# Database User
resource "google_sql_user" "main" {
  name     = var.database_user
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  password = var.database_password

  deletion_policy = "ABANDON"
}
