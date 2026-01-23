# VPC
resource "google_compute_network" "main" {
  name                    = "${var.project_name}-vpc-${var.environment}"
  project                 = var.project_id
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

# Subnet
resource "google_compute_subnetwork" "main" {
  name                     = "${var.project_name}-subnet-${var.environment}"
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.main.id
  ip_cidr_range            = var.subnet_cidr
  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Cloud Router for Cloud NAT
resource "google_compute_router" "main" {
  name    = "${var.project_name}-router-${var.environment}"
  project = var.project_id
  region  = var.region
  network = google_compute_network.main.id
}

# Cloud NAT
resource "google_compute_router_nat" "main" {
  name                               = "${var.project_name}-nat-${var.environment}"
  project                            = var.project_id
  region                             = var.region
  router                             = google_compute_router.main.name
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Serverless VPC Access Connector
resource "google_vpc_access_connector" "main" {
  name          = "${var.project_name}-connector-${var.environment}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.main.id
  ip_cidr_range = var.connector_cidr
  min_instances = var.connector_min_instances
  max_instances = var.connector_max_instances

  depends_on = [google_compute_network.main]
}

# Private Services Access for Cloud SQL
resource "google_compute_global_address" "private_ip_range" {
  name          = "${var.project_name}-private-ip-${var.environment}"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]

  depends_on = [google_compute_global_address.private_ip_range]
}

# Firewall rules
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.project_name}-allow-internal-${var.environment}"
  project = var.project_id
  network = google_compute_network.main.id

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.subnet_cidr, var.connector_cidr]
  priority      = 1000
}

resource "google_compute_firewall" "allow_health_checks" {
  name    = "${var.project_name}-allow-health-checks-${var.environment}"
  project = var.project_id
  network = google_compute_network.main.id

  allow {
    protocol = "tcp"
    ports    = ["8080"]
  }

  # Google Cloud health check IP ranges
  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]
  priority      = 1000
}
