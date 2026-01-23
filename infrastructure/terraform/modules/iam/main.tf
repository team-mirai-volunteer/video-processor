# Service Account for Cloud Run
resource "google_service_account" "cloud_run" {
  account_id   = "${var.project_name}-run-sa-${var.environment}"
  display_name = "Cloud Run Service Account for ${var.project_name} (${var.environment})"
  project      = var.project_id
}

# Cloud SQL Client role for Cloud Run service account
resource "google_project_iam_member" "cloud_run_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Secret Manager accessor role for Cloud Run service account
resource "google_project_iam_member" "cloud_run_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Storage admin role for Cloud Run service account (for temporary file operations)
resource "google_project_iam_member" "cloud_run_storage_admin" {
  count   = var.enable_storage_access ? 1 : 0
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Logging writer role for Cloud Run service account
resource "google_project_iam_member" "cloud_run_logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Trace agent role for Cloud Run service account
resource "google_project_iam_member" "cloud_run_trace_agent" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Service Account for Cloud SQL (optional, for advanced configurations)
resource "google_service_account" "cloud_sql" {
  count        = var.create_sql_service_account ? 1 : 0
  account_id   = "${var.project_name}-sql-sa-${var.environment}"
  display_name = "Cloud SQL Service Account for ${var.project_name} (${var.environment})"
  project      = var.project_id
}

# Allow Cloud Run to invoke itself (for internal services)
resource "google_cloud_run_service_iam_member" "cloud_run_invoker" {
  count    = var.cloud_run_service_name != "" ? 1 : 0
  project  = var.project_id
  location = var.region
  service  = var.cloud_run_service_name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Allow all users to invoke Cloud Run (public access)
resource "google_cloud_run_service_iam_member" "cloud_run_public_invoker" {
  count    = var.cloud_run_service_name != "" && var.allow_public_access ? 1 : 0
  project  = var.project_id
  location = var.region
  service  = var.cloud_run_service_name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Artifact Registry reader role (for pulling container images)
resource "google_project_iam_member" "cloud_run_artifact_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}
