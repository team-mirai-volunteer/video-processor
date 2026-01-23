terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "compute.googleapis.com",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
    "vpcaccess.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# Random password for database
resource "random_password" "database_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store database password in Secret Manager
resource "google_secret_manager_secret" "database_password" {
  secret_id = "${var.project_name}-db-password-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "database_password" {
  secret      = google_secret_manager_secret.database_password.id
  secret_data = random_password.database_password.result
}

# Networking Module
module "networking" {
  source = "../../modules/networking"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
  environment  = var.environment

  subnet_cidr             = var.subnet_cidr
  connector_cidr          = var.connector_cidr
  connector_min_instances = var.connector_min_instances
  connector_max_instances = var.connector_max_instances

  depends_on = [google_project_service.required_apis]
}

# IAM Module
module "iam" {
  source = "../../modules/iam"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
  environment  = var.environment

  enable_storage_access      = var.enable_storage_access
  create_sql_service_account = false
  allow_public_access        = var.allow_public_access

  depends_on = [google_project_service.required_apis]
}

# Cloud SQL Module
module "cloud_sql" {
  source = "../../modules/cloud-sql"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
  environment  = var.environment

  network_id             = module.networking.network_id
  private_vpc_connection = module.networking.private_vpc_connection

  database_version  = var.database_version
  tier              = var.database_tier
  availability_type = var.database_availability_type
  disk_size         = var.database_disk_size
  disk_type         = var.database_disk_type
  disk_autoresize   = var.database_disk_autoresize

  deletion_protection            = var.database_deletion_protection
  backup_enabled                 = var.database_backup_enabled
  point_in_time_recovery_enabled = var.database_point_in_time_recovery_enabled
  retained_backups               = var.database_retained_backups

  database_name     = var.database_name
  database_user     = var.database_user
  database_password = random_password.database_password.result

  max_connections            = var.database_max_connections
  log_min_duration_statement = var.database_log_min_duration_statement

  depends_on = [module.networking]
}

# Cloud Run Module
module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
  environment  = var.environment

  container_image       = var.container_image
  service_account_email = module.iam.cloud_run_service_account_email
  vpc_connector_id      = module.networking.vpc_connector_id
  vpc_egress            = var.vpc_egress

  cloud_sql_connection_name = module.cloud_sql.instance_connection_name

  min_instances       = var.cloud_run_min_instances
  max_instances       = var.cloud_run_max_instances
  cpu                 = var.cloud_run_cpu
  memory              = var.cloud_run_memory
  timeout_seconds     = var.cloud_run_timeout_seconds
  container_port      = var.cloud_run_container_port
  allow_public_access = var.allow_public_access

  environment_variables = merge(
    {
      NODE_ENV             = var.environment
      GOOGLE_CLOUD_PROJECT = var.project_id
      DATABASE_HOST        = "/cloudsql/${module.cloud_sql.instance_connection_name}"
      DATABASE_NAME        = module.cloud_sql.database_name
      DATABASE_USER        = module.cloud_sql.database_user
    },
    var.additional_environment_variables
  )

  secret_environment_variables = {
    database_password = {
      name      = "DATABASE_PASSWORD"
      secret_id = google_secret_manager_secret.database_password.secret_id
      version   = "latest"
    }
  }

  health_check_path = var.health_check_path

  depends_on = [module.cloud_sql, module.iam]
}
