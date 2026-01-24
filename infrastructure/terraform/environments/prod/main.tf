terraform {
  required_version = ">= 1.0.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "video-processor-terraform-state"
    prefix = "prod"
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
    "cloudtrace.googleapis.com",
    "logging.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# IAM Module
module "iam" {
  source = "../../modules/iam"

  project_id   = var.project_id
  project_name = var.project_name
}

# Networking Module
module "networking" {
  source = "../../modules/networking"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
  subnet_cidr  = var.subnet_cidr

  depends_on = [google_project_service.apis]
}

# Cloud SQL Module
module "cloud_sql" {
  source = "../../modules/cloud-sql"

  project_id             = var.project_id
  project_name           = var.project_name
  region                 = var.region
  network_id             = module.networking.network_id
  private_vpc_connection = module.networking.private_vpc_connection

  tier                = var.database_tier
  availability_type   = var.database_availability_type
  disk_size           = var.database_disk_size
  backup_enabled      = var.database_backup_enabled
  deletion_protection = var.database_deletion_protection
  database_name       = var.database_name
  database_user       = var.database_user
  database_password   = var.database_password

  depends_on = [module.networking]
}

# Cloud Run Module
module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id                = var.project_id
  project_name              = var.project_name
  region                    = var.region
  container_image           = var.container_image
  service_account_email     = module.iam.cloud_run_service_account_email
  vpc_connector_id          = module.networking.vpc_connector_id
  cloud_sql_connection_name = module.cloud_sql.instance_connection_name

  cpu             = var.cloud_run_cpu
  memory          = var.cloud_run_memory
  timeout_seconds = var.cloud_run_timeout
  min_instances   = var.cloud_run_min_instances
  max_instances   = var.cloud_run_max_instances

  environment_variables = {
    NODE_ENV             = "production"
    DATABASE_URL         = "postgresql://${var.database_user}:${var.database_password}@/video_processor?host=/cloudsql/${module.cloud_sql.instance_connection_name}"
    GOOGLE_CLOUD_PROJECT = var.project_id
    CORS_ORIGIN          = var.cors_origin
  }

  allow_unauthenticated = var.allow_unauthenticated

  depends_on = [module.iam, module.networking, module.cloud_sql]
}
