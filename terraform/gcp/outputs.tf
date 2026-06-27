output "vpc_id" {
  description = "The ID of the VPC."
  value       = google_compute_network.vpc.id
}

output "artifact_registry_repo" {
  description = "The Artifact Registry repository URL."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}"
}

output "gke_cluster_name" {
  description = "The name of the private GKE cluster."
  value       = google_container_cluster.gke.name
}

output "gke_endpoint" {
  description = "The GKE private endpoint."
  value       = google_container_cluster.gke.endpoint
}

output "cloud_run_url" {
  description = "The URL of the serverless Cloud Run application."
  value       = google_cloud_run_v2_service.app.uri
}

output "cloud_sql_private_ip" {
  description = "The private IP address of the Cloud SQL PostgreSQL instance."
  value       = google_sql_database_instance.db.private_ip_address
}

output "redis_host" {
  description = "The private host IP of the Memorystore Redis instance."
  value       = google_redis_instance.redis.host
}

output "agent_workspace_bucket_name" {
  description = "The name of the Google Cloud Storage bucket for agent workspace state."
  value       = google_storage_bucket.agent_bucket.name
}

output "agent_engine_service_url" {
  description = "The internal Service URL of the AI Agent Engine on Cloud Run."
  value       = google_cloud_run_v2_service.agent_engine.uri
}
