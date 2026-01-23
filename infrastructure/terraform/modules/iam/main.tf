# IAM Module - Service Accounts and IAM Bindings

# Cloud Run Service Account
resource "google_service_account" "cloud_run" {
  account_id   = var.cloud_run_sa_name
  display_name = var.cloud_run_sa_display_name
  project      = var.project_id
}

# IAM Bindings for Cloud Run Service Account

# Cloud SQL Client - allows connecting to Cloud SQL
resource "google_project_iam_member" "cloud_run_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Secret Manager Secret Accessor - allows reading secrets
resource "google_project_iam_member" "cloud_run_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Logging Writer - allows writing logs
resource "google_project_iam_member" "cloud_run_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Trace Agent - allows sending trace data
resource "google_project_iam_member" "cloud_run_trace_agent" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Service Account User - allows the service account to act as itself
resource "google_project_iam_member" "cloud_run_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}
