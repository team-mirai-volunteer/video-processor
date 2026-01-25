# GCP Project
project_id   = "${GCP_PROJECT_ID}"
project_name = "video-processor-stg"
region       = "asia-northeast1"

# Database
database_password = "${DATABASE_PASSWORD}"

# Secrets
openai_api_key          = "${OPENAI_API_KEY}"
google_credentials_json = <<-EOF
${GOOGLE_CREDENTIALS_JSON}
EOF

# Application
container_image               = "${CONTAINER_IMAGE}"
migration_image               = "${MIGRATION_IMAGE}"
cors_origin                   = "${CORS_ORIGIN}"
google_drive_output_folder_id = "${GOOGLE_DRIVE_OUTPUT_FOLDER_ID}"
