# Project Configuration
project_id   = "video-processor-dev"
project_name = "video-processor-dev"
region       = "asia-northeast1"

# Networking Configuration
subnet_cidr    = "10.1.0.0/24"
connector_cidr = "10.9.0.0/28"

# Database Configuration (Development settings - minimal resources)
database_tier                = "db-f1-micro"
database_availability_type   = "ZONAL"
database_disk_size           = 10
database_backup_enabled      = false
database_deletion_protection = false
database_name                = "video_processor"
database_user                = "app"
# database_password should be provided via environment variable or secret

# Cloud Run Configuration (Development settings - minimal resources)
container_image         = "gcr.io/video-processor-dev/backend:latest"
cloud_run_cpu           = "1"
cloud_run_memory        = "1Gi"
cloud_run_timeout       = 300
cloud_run_min_instances = 0
cloud_run_max_instances = 2
cors_origin             = "*"
allow_unauthenticated   = true

# Google Drive Configuration
# google_drive_service_account_email should be provided via environment variable or secret
# google_drive_output_folder_id should be provided via environment variable or secret
