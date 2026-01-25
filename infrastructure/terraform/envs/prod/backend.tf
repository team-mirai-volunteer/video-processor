terraform {
  backend "gcs" {
    bucket = "video-processor-tfstate"
  }
}
