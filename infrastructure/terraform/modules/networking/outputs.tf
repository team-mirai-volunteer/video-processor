output "network_id" {
  description = "VPC network ID"
  value       = google_compute_network.main.id
}

output "network_name" {
  description = "VPC network name"
  value       = google_compute_network.main.name
}

output "network_self_link" {
  description = "VPC network self link"
  value       = google_compute_network.main.self_link
}

output "subnet_id" {
  description = "Subnet ID"
  value       = google_compute_subnetwork.main.id
}

output "subnet_name" {
  description = "Subnet name"
  value       = google_compute_subnetwork.main.name
}

output "subnet_self_link" {
  description = "Subnet self link"
  value       = google_compute_subnetwork.main.self_link
}

output "vpc_connector_id" {
  description = "VPC Access Connector ID"
  value       = google_vpc_access_connector.main.id
}

output "vpc_connector_name" {
  description = "VPC Access Connector name"
  value       = google_vpc_access_connector.main.name
}

output "private_vpc_connection" {
  description = "Private VPC connection for Cloud SQL"
  value       = google_service_networking_connection.private_vpc_connection.id
}

output "router_name" {
  description = "Cloud Router name"
  value       = google_compute_router.main.name
}

output "nat_name" {
  description = "Cloud NAT name"
  value       = google_compute_router_nat.main.name
}
