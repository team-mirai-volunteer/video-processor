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

# Networking
module "networking" {
  source = "../../modules/networking"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region

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

# Cloud Run (create service account first for secrets IAM)
module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region

  container_image = var.container_image

  # stg environment settings
  cpu             = "1"
  memory          = "1Gi"
  min_instances   = 0
  max_instances   = 2
  request_timeout = 300

  allow_unauthenticated = true

  vpc_connector_id = module.networking.vpc_connector_id

  cloud_sql_connection_name = module.cloud_sql.connection_name
  database_name             = module.cloud_sql.database_name
  database_user             = module.cloud_sql.database_user
  database_password         = var.database_password

  openai_api_key_secret_id     = module.secrets.openai_api_key_secret_id
  google_credentials_secret_id = module.secrets.google_credentials_secret_id

  cors_origin                  = var.cors_origin
  google_drive_output_folder_id = var.google_drive_output_folder_id

  depends_on = [module.cloud_sql, module.secrets]
}

# Secrets
module "secrets" {
  source = "../../modules/secrets"

  project_id   = var.project_id
  project_name = var.project_name

  openai_api_key          = var.openai_api_key
  google_credentials_json = var.google_credentials_json

  # Use the Cloud Run service account email
  # Note: This creates a dependency cycle, so we construct the email manually
  cloud_run_service_account_email = "${var.project_name}-run-sa@${var.project_id}.iam.gserviceaccount.com"

  depends_on = [google_project_service.apis]
}
