terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "compute.googleapis.com",
    "vpcaccess.googleapis.com",
    "servicenetworking.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# Service Account for Cloud Run (created early for Secrets IAM binding)
resource "google_service_account" "cloud_run" {
  account_id   = "${var.project_name}-run-sa"
  display_name = "Cloud Run Service Account for ${var.project_name}"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}

# Networking
module "networking" {
  source = "../../modules/networking"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
  env          = var.env

  depends_on = [google_project_service.apis]
}

# Cloud SQL
module "cloud_sql" {
  source = "../../modules/cloud-sql"

  project_id             = var.project_id
  project_name           = var.project_name
  region                 = var.region
  vpc_id                 = module.networking.vpc_id
  private_vpc_connection = module.networking.private_vpc_connection

  # stg environment settings
  tier                = "db-f1-micro"
  availability_type   = "ZONAL"
  disk_size           = 10
  backup_enabled      = false
  deletion_protection = false

  database_password = var.database_password

  depends_on = [module.networking]
}

# Cloud Run
module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region

  container_image       = var.container_image
  migration_image       = var.migration_image
  service_account_email = google_service_account.cloud_run.email

  # stg environment settings
  cpu             = "4"
  memory          = "16Gi"
  min_instances   = 0
  max_instances   = 1
  concurrency     = 80
  request_timeout = 900 # 15 minutes for large video processing

  allow_unauthenticated = true

  vpc_connector_id = module.networking.vpc_connector_id

  cloud_sql_connection_name = module.cloud_sql.connection_name
  database_name             = module.cloud_sql.database_name
  database_user             = module.cloud_sql.database_user

  openai_api_key_secret_id     = module.secrets.openai_api_key_secret_id
  google_credentials_secret_id = module.secrets.google_credentials_secret_id
  database_password_secret_id  = module.secrets.database_password_secret_id
  webapp_api_key_secret_id     = module.secrets.webapp_api_key_secret_id
  gemini_api_key_secret_id     = module.secrets.gemini_api_key_secret_id
  fish_audio_api_key_secret_id = module.secrets.fish_audio_api_key_secret_id
  fish_audio_default_voice_model_id = var.fish_audio_default_voice_model_id

  cors_origin                   = var.cors_origin
  google_drive_output_folder_id = var.google_drive_output_folder_id
  transcript_output_folder_id   = var.transcript_output_folder_id

  # GCS Temp Storage
  temp_storage_type  = var.temp_storage_type
  video_temp_bucket  = var.video_temp_bucket

  depends_on = [module.cloud_sql, module.secrets]
}

# Secrets
module "secrets" {
  source = "../../modules/secrets"

  project_id   = var.project_id
  project_name = var.project_name

  openai_api_key          = var.openai_api_key
  google_credentials_json = var.google_credentials_json
  database_password       = var.database_password
  webapp_api_key          = var.webapp_api_key
  gemini_api_key          = var.gemini_api_key
  fish_audio_api_key      = var.fish_audio_api_key
  fish_audio_default_voice_model_id = var.fish_audio_default_voice_model_id

  # Use the Cloud Run service account email from the resource we created above
  cloud_run_service_account_email = google_service_account.cloud_run.email

  depends_on = [google_project_service.apis, google_service_account.cloud_run]
}
