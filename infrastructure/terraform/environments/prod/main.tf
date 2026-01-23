# Production Environment Configuration
# This configuration orchestrates all modules for the production environment

locals {
  name_prefix   = "video-processor"
  database_name = "video_processor"
  database_user = "app"
}

# =============================================================================
# 1. Networking Module
# Creates VPC, subnets, Cloud NAT, and Serverless VPC Access Connector
# =============================================================================
module "networking" {
  source = "../../modules/networking"

  project_id   = var.project_id
  region       = var.region
  network_name = "${local.name_prefix}-vpc-${var.environment}"
  subnet_name  = "${local.name_prefix}-subnet-${var.environment}"
  subnet_cidr  = "10.0.0.0/24"

  connector_name          = "${local.name_prefix}-connector-${var.environment}"
  connector_cidr          = "10.8.0.0/28"
  connector_machine_type  = "e2-micro"
  connector_min_instances = 2
  connector_max_instances = 3
}

# =============================================================================
# 2. IAM Module
# Creates service accounts and IAM bindings for Cloud Run
# =============================================================================
module "iam" {
  source = "../../modules/iam"

  project_id                = var.project_id
  cloud_run_sa_name         = "${local.name_prefix}-run-sa-${var.environment}"
  cloud_run_sa_display_name = "Video Processor Cloud Run Service Account (${var.environment})"
}

# =============================================================================
# 3. Cloud SQL Module
# Creates PostgreSQL instance with private IP
# =============================================================================
module "cloud_sql" {
  source = "../../modules/cloud-sql"

  project_id        = var.project_id
  region            = var.region
  instance_name     = "${local.name_prefix}-db-${var.environment}"
  machine_type      = var.cloud_sql_machine_type
  availability_type = "ZONAL"

  # Network configuration
  network_id             = module.networking.vpc_id
  private_vpc_connection = module.networking.private_vpc_connection

  # Database configuration
  database_name     = local.database_name
  database_user     = local.database_user
  database_password = var.database_password

  # Backup configuration
  backup_enabled                 = true
  backup_start_time              = "03:00"
  backup_location                = "asia"
  point_in_time_recovery_enabled = true
  backup_retained_count          = 7

  # Protection
  deletion_protection = var.cloud_sql_deletion_protection

  depends_on = [module.networking]
}

# =============================================================================
# 4. Cloud Run Module
# Deploys the API service with VPC access and Cloud SQL connection
# =============================================================================
module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  service_name = "${local.name_prefix}-api-${var.environment}"

  # Container configuration
  image_url = var.cloud_run_image
  cpu       = var.cloud_run_cpu
  memory    = var.cloud_run_memory

  # Scaling configuration
  min_instances   = var.cloud_run_min_instances
  max_instances   = var.cloud_run_max_instances
  timeout_seconds = 3600

  # Network configuration
  vpc_connector_id          = module.networking.vpc_connector_id
  cloud_sql_connection_name = module.cloud_sql.connection_name

  # IAM configuration
  service_account_email = module.iam.cloud_run_sa_email
  allow_unauthenticated = true

  # Environment variables
  environment_variables = {
    NODE_ENV             = "production"
    GOOGLE_CLOUD_PROJECT = var.project_id
    CORS_ORIGIN          = var.frontend_url
    PORT                 = "8080"
    DB_HOST              = "/cloudsql/${module.cloud_sql.connection_name}"
    DB_NAME              = local.database_name
    DB_USER              = local.database_user
  }

  # Secret environment variables (configure in Secret Manager)
  secret_environment_variables = {
    DATABASE_URL = {
      secret_name = "${local.name_prefix}-database-url"
      version     = "latest"
    }
    GOOGLE_GENERATIVE_AI_API_KEY = {
      secret_name = "${local.name_prefix}-gemini-api-key"
      version     = "latest"
    }
  }

  depends_on = [module.networking, module.iam, module.cloud_sql]
}
