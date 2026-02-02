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
webapp_api_key = "${WEBAPP_API_KEY}"
gemini_api_key = "${GEMINI_API_KEY}"
fish_audio_api_key = "${FISH_AUDIO_API_KEY}"
fish_audio_default_voice_model_id = "${FISH_AUDIO_DEFAULT_VOICE_MODEL_ID}"
anthropic_api_key = "${ANTHROPIC_API_KEY}"

# Application
container_image               = "${CONTAINER_IMAGE}"
migration_image               = "${MIGRATION_IMAGE}"
cors_origin                   = "${CORS_ORIGIN}"
google_drive_output_folder_id = "${GOOGLE_DRIVE_OUTPUT_FOLDER_ID}"
transcript_output_folder_id   = "${TRANSCRIPT_OUTPUT_FOLDER_ID}"
