# Project Configuration
project_id   = "video-processor-prod"
project_name = "video-processor"
region       = "asia-northeast1"

# Networking Configuration
subnet_cidr    = "10.0.0.0/24"
connector_cidr = "10.8.0.0/28"

# Database Configuration (Production settings)
database_tier                = "db-custom-2-4096"
database_availability_type   = "REGIONAL"
database_disk_size           = 20
database_backup_enabled      = true
database_deletion_protection = true
database_name                = "video_processor"
database_user                = "app"
# database_password should be provided via environment variable or secret

# Cloud Run Configuration (Production settings)
container_image         = "gcr.io/video-processor-prod/backend:latest"
cloud_run_cpu           = "2"
cloud_run_memory        = "2Gi"
cloud_run_timeout       = 3600
cloud_run_min_instances = 0
cloud_run_max_instances = 10
cors_origin             = "https://video-processor.vercel.app"
allow_unauthenticated   = false

# Google Drive Configuration
# google_drive_service_account_email should be provided via environment variable or secret
# google_drive_output_folder_id should be provided via environment variable or secret
