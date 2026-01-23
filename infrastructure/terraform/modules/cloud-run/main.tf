# Cloud Run Service
resource "google_cloud_run_v2_service" "main" {
  name     = "${var.project_name}-api-${var.environment}"
  project  = var.project_id
  location = var.region
  ingress  = var.ingress

  template {
    service_account = var.service_account_email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    timeout = "${var.timeout_seconds}s"

    vpc_access {
      connector = var.vpc_connector_id
      egress    = var.vpc_egress
    }

    containers {
      name  = "api"
      image = var.container_image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = var.cpu_idle
        startup_cpu_boost = var.startup_cpu_boost
      }

      ports {
        name           = "http1"
        container_port = var.container_port
      }

      dynamic "env" {
        for_each = var.environment_variables
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_environment_variables
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = env.value.secret_id
              version = env.value.version
            }
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      startup_probe {
        http_get {
          path = var.health_check_path
          port = var.container_port
        }
        initial_delay_seconds = var.startup_probe_initial_delay
        timeout_seconds       = var.startup_probe_timeout
        period_seconds        = var.startup_probe_period
        failure_threshold     = var.startup_probe_failure_threshold
      }

      liveness_probe {
        http_get {
          path = var.health_check_path
          port = var.container_port
        }
        initial_delay_seconds = var.liveness_probe_initial_delay
        timeout_seconds       = var.liveness_probe_timeout
        period_seconds        = var.liveness_probe_period
        failure_threshold     = var.liveness_probe_failure_threshold
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [var.cloud_sql_connection_name]
      }
    }

    labels = {
      environment = var.environment
      project     = var.project_name
      managed_by  = "terraform"
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  labels = {
    environment = var.environment
    project     = var.project_name
    managed_by  = "terraform"
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version
    ]
  }
}

# IAM binding for public access (if enabled)
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count    = var.allow_public_access ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.main.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Domain mapping (if custom domain is provided)
resource "google_cloud_run_domain_mapping" "main" {
  count    = var.custom_domain != "" ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = var.custom_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.main.name
  }
}
