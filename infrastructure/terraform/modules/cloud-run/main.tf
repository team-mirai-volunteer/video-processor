# IAM roles for the service account (passed in from outside)
resource "google_project_iam_member" "cloud_run_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${var.service_account_email}"
}

resource "google_project_iam_member" "cloud_run_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${var.service_account_email}"
}

resource "google_project_iam_member" "cloud_run_trace" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${var.service_account_email}"
}

# GCS Bucket for temporary video storage
resource "google_storage_bucket" "video_temp" {
  name     = "${var.project_id}-video-processor-temp"
  location = var.region
  project  = var.project_id

  # Auto-delete objects after 60 days
  lifecycle_rule {
    condition {
      age = 60
    }
    action {
      type = "Delete"
    }
  }

  force_destroy = true

  uniform_bucket_level_access = true
}

# Grant Cloud Run service account access to the bucket
resource "google_storage_bucket_iam_member" "video_temp_access" {
  bucket = google_storage_bucket.video_temp.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.service_account_email}"
}

# Artifact Registry Repository
resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = var.project_name
  description   = "Docker repository for ${var.project_name}"
  format        = "DOCKER"
  project       = var.project_id
}

# Cloud Run Service
resource "google_cloud_run_v2_service" "main" {
  name     = "${var.project_name}-api"
  location = var.region
  project  = var.project_id

  template {
    service_account = var.service_account_email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    max_instance_request_concurrency = var.concurrency

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.container_image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = false
        startup_cpu_boost = true
      }

      # Environment variables
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "DATABASE_HOST"
        value = "/cloudsql/${var.cloud_sql_connection_name}"
      }

      env {
        name  = "DATABASE_NAME"
        value = var.database_name
      }

      env {
        name  = "DATABASE_USER"
        value = var.database_user
      }

      env {
        name = "DATABASE_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = var.database_password_secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "CORS_ORIGIN"
        value = var.cors_origin
      }

      env {
        name  = "GOOGLE_DRIVE_OUTPUT_FOLDER_ID"
        value = var.google_drive_output_folder_id
      }

      env {
        name  = "TRANSCRIPT_OUTPUT_FOLDER_ID"
        value = var.transcript_output_folder_id
      }

      env {
        name  = "GOOGLE_SERVICE_ACCOUNT_EMAIL"
        value = var.service_account_email
      }

      # GCS Temp Storage
      env {
        name  = "TEMP_STORAGE_TYPE"
        value = var.temp_storage_type
      }

      env {
        name  = "VIDEO_TEMP_BUCKET"
        value = var.video_temp_bucket != "" ? var.video_temp_bucket : "${var.project_id}-video-processor-temp"
      }

      # Secret environment variables
      env {
        name = "OPENAI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.openai_api_key_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GOOGLE_APPLICATION_CREDENTIALS_JSON"
        value_source {
          secret_key_ref {
            secret  = var.google_credentials_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "WEBAPP_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.webapp_api_key_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.gemini_api_key_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "FISH_AUDIO_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.fish_audio_api_key_secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "FISH_AUDIO_DEFAULT_VOICE_MODEL_ID"
        value = var.fish_audio_default_voice_model_id
      }

      # Cloud SQL connection
      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      ports {
        container_port = 8080
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [var.cloud_sql_connection_name]
      }
    }

    timeout = "${var.request_timeout}s"
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Allow unauthenticated access
resource "google_cloud_run_v2_service_iam_member" "allow_unauthenticated" {
  count    = var.allow_unauthenticated ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.main.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Run Job for database migration
resource "google_cloud_run_v2_job" "migration" {
  name     = "${var.project_name}-migration"
  location = var.region
  project  = var.project_id

  template {
    template {
      service_account = var.service_account_email

      vpc_access {
        connector = var.vpc_connector_id
        egress    = "PRIVATE_RANGES_ONLY"
      }

      containers {
        image = var.migration_image

        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        env {
          name  = "DATABASE_HOST"
          value = "/cloudsql/${var.cloud_sql_connection_name}"
        }

        env {
          name  = "DATABASE_NAME"
          value = var.database_name
        }

        env {
          name  = "DATABASE_USER"
          value = var.database_user
        }

        env {
          name = "DATABASE_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = var.database_password_secret_id
              version = "latest"
            }
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [var.cloud_sql_connection_name]
        }
      }

      timeout     = "300s"
      max_retries = 1
    }
  }

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }
}

# Run migration job after creation
resource "null_resource" "run_migration" {
  triggers = {
    migration_image = var.migration_image
  }

  provisioner "local-exec" {
    command = <<-EOT
      gcloud run jobs execute ${var.project_name}-migration \
        --region=${var.region} \
        --project=${var.project_id} \
        --wait
    EOT
  }

  depends_on = [google_cloud_run_v2_job.migration, google_cloud_run_v2_service.main]
}
