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
