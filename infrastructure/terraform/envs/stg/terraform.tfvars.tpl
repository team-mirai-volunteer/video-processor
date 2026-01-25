# GCP Project
project_id   = "${GCP_PROJECT_ID}"
project_name = "video-processor-stg"
region       = "asia-northeast1"

# Database
database_password = "${DATABASE_PASSWORD}"

# Secrets
openai_api_key          = "${OPENAI_API_KEY}"
google_credentials_json = "${GOOGLE_CREDENTIALS_JSON}"

# Application
container_image               = "${CONTAINER_IMAGE}"
cors_origin                   = "${CORS_ORIGIN}"
google_drive_output_folder_id = "${GOOGLE_DRIVE_OUTPUT_FOLDER_ID}"
