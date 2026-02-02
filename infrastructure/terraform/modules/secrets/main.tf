# Secret: OpenAI API Key
resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "${var.project_name}-openai-api-key"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "openai_api_key" {
  secret      = google_secret_manager_secret.openai_api_key.id
  secret_data = var.openai_api_key
}

# Secret: Google Credentials JSON
resource "google_secret_manager_secret" "google_credentials" {
  secret_id = "${var.project_name}-google-credentials"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "google_credentials" {
  secret      = google_secret_manager_secret.google_credentials.id
  secret_data = var.google_credentials_json
}

# IAM: Allow Cloud Run service account to access secrets
resource "google_secret_manager_secret_iam_member" "openai_api_key_access" {
  secret_id = google_secret_manager_secret.openai_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cloud_run_service_account_email}"
  project   = var.project_id
}

resource "google_secret_manager_secret_iam_member" "google_credentials_access" {
  secret_id = google_secret_manager_secret.google_credentials.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cloud_run_service_account_email}"
  project   = var.project_id
}

# Secret: Database Password
resource "google_secret_manager_secret" "database_password" {
  secret_id = "${var.project_name}-database-password"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_password" {
  secret      = google_secret_manager_secret.database_password.id
  secret_data = var.database_password
}

resource "google_secret_manager_secret_iam_member" "database_password_access" {
  secret_id = google_secret_manager_secret.database_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cloud_run_service_account_email}"
  project   = var.project_id
}

# Secret: Webapp API Key
resource "google_secret_manager_secret" "webapp_api_key" {
  secret_id = "${var.project_name}-webapp-api-key"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "webapp_api_key" {
  secret      = google_secret_manager_secret.webapp_api_key.id
  secret_data = var.webapp_api_key
}

resource "google_secret_manager_secret_iam_member" "webapp_api_key_access" {
  secret_id = google_secret_manager_secret.webapp_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cloud_run_service_account_email}"
  project   = var.project_id
}

# Secret: Gemini API Key
resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "${var.project_name}-gemini-api-key"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "gemini_api_key" {
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = var.gemini_api_key
}

resource "google_secret_manager_secret_iam_member" "gemini_api_key_access" {
  secret_id = google_secret_manager_secret.gemini_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cloud_run_service_account_email}"
  project   = var.project_id
}

# Secret: Fish Audio API Key
resource "google_secret_manager_secret" "fish_audio_api_key" {
  secret_id = "${var.project_name}-fish-audio-api-key"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "fish_audio_api_key" {
  secret      = google_secret_manager_secret.fish_audio_api_key.id
  secret_data = var.fish_audio_api_key
}

resource "google_secret_manager_secret_iam_member" "fish_audio_api_key_access" {
  secret_id = google_secret_manager_secret.fish_audio_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cloud_run_service_account_email}"
  project   = var.project_id
}

# Secret: Anthropic API Key
resource "google_secret_manager_secret" "anthropic_api_key" {
  secret_id = "${var.project_name}-anthropic-api-key"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "anthropic_api_key" {
  secret      = google_secret_manager_secret.anthropic_api_key.id
  secret_data = var.anthropic_api_key
}

resource "google_secret_manager_secret_iam_member" "anthropic_api_key_access" {
  secret_id = google_secret_manager_secret.anthropic_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cloud_run_service_account_email}"
  project   = var.project_id
}
