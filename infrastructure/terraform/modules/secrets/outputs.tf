output "openai_api_key_secret_id" {
  description = "Secret Manager secret ID for OpenAI API key"
  value       = google_secret_manager_secret.openai_api_key.secret_id
}

output "openai_api_key_secret_version" {
  description = "Secret Manager secret version for OpenAI API key"
  value       = google_secret_manager_secret_version.openai_api_key.name
}

output "google_credentials_secret_id" {
  description = "Secret Manager secret ID for Google credentials"
  value       = google_secret_manager_secret.google_credentials.secret_id
}

output "google_credentials_secret_version" {
  description = "Secret Manager secret version for Google credentials"
  value       = google_secret_manager_secret_version.google_credentials.name
}

output "database_password_secret_id" {
  description = "Secret Manager secret ID for database password"
  value       = google_secret_manager_secret.database_password.secret_id
}

output "webapp_api_key_secret_id" {
  description = "Secret Manager secret ID for webapp API key"
  value       = google_secret_manager_secret.webapp_api_key.secret_id
}

output "gemini_api_key_secret_id" {
  description = "Secret Manager secret ID for Gemini API key"
  value       = google_secret_manager_secret.gemini_api_key.secret_id
}

output "fish_audio_api_key_secret_id" {
  description = "Secret Manager secret ID for Fish Audio API key"
  value       = google_secret_manager_secret.fish_audio_api_key.secret_id
}
