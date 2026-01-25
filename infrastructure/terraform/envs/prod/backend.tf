terraform {
  backend "gcs" {
    bucket = "mirai-video-processor-tfstate"
  }
}
