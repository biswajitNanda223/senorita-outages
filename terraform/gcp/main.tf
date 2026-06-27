terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.10.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

#---------------------------------------------------------
# Google Project APIs (Tracing & Monitoring)
#---------------------------------------------------------
resource "google_project_service" "trace" {
  project            = var.project_id
  service            = "cloudtrace.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "monitoring" {
  project            = var.project_id
  service            = "monitoring.googleapis.com"
  disable_on_destroy = false
}

#---------------------------------------------------------
# Networking: VPC & Subnets
#---------------------------------------------------------
resource "google_compute_network" "vpc" {
  name                    = "${var.vpc_name}-${var.environment}"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "gke_subnet" {
  name          = "subnet-gke-${var.environment}"
  ip_cidr_range = "10.10.0.0/20"
  region        = var.region
  network       = google_compute_network.vpc.id
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "gke-pods"
    ip_cidr_range = "192.168.0.0/18"
  }

  secondary_ip_range {
    range_name    = "gke-services"
    ip_cidr_range = "192.168.64.0/20"
  }
}

# Serverless VPC Access connector for Cloud Run VNet integration
resource "google_vpc_access_connector" "connector" {
  name          = "vpc-connector-${var.environment}"
  region        = var.region
  ip_cidr_range = "10.10.16.0/28"
  network       = google_compute_network.vpc.id
}

# Cloud NAT for private egress
resource "google_compute_router" "router" {
  name    = "router-${var.environment}"
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "nat-${var.environment}"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

#---------------------------------------------------------
# Private Service Access for database peering
#---------------------------------------------------------
resource "google_compute_global_address" "private_ip_alloc" {
  name          = "private-ip-alloc"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_alloc.name]
}

#---------------------------------------------------------
# Artifact Registry (Container Registry)
#---------------------------------------------------------
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "enterprise-registry-${var.environment}"
  description   = "Docker Repository for Enterprise application images"
  format        = "DOCKER"
}

#---------------------------------------------------------
# GKE Private Cluster
#---------------------------------------------------------
resource "google_container_cluster" "gke" {
  name     = "gke-enterprise-${var.environment}"
  location = var.region

  network    = google_compute_network.vpc.id
  subnetwork = google_compute_subnetwork.gke_subnet.id

  remove_default_node_pool = true
  initial_node_count       = 1

  ip_allocation_policy {
    cluster_secondary_range_name  = "gke-pods"
    services_secondary_range_name = "gke-services"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = true
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "10.10.0.0/20"
      display_name = "gke-nodes"
    }
  }
}

resource "google_container_node_pool" "gke_nodes" {
  name       = "primary-node-pool"
  location   = var.region
  cluster    = google_container_cluster.gke.name
  node_count = 2

  node_config {
    preemptible  = true
    machine_type = "e2-medium"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }
}

#---------------------------------------------------------
# Database: Cloud SQL PostgreSQL
#---------------------------------------------------------
resource "google_sql_database_instance" "db" {
  name             = "sql-postgres-enterprise"
  database_version = "POSTGRES_15"
  region           = var.region

  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier = "db-f1-micro"
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }
  }
}

#---------------------------------------------------------
# Memorystore for Redis
#---------------------------------------------------------
resource "google_redis_instance" "redis" {
  name           = "redis-enterprise-${var.environment}"
  tier           = "BASIC"
  memory_size_gb = 1

  region                  = var.region
  location_id             = "${var.region}-a"
  authorized_network      = google_compute_network.vpc.id
  connect_mode            = "PRIVATE_SERVICE_ACCESS"
  redis_version           = "REDIS_7_0"
  displayName             = "Enterprise Redis Instance"

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

#---------------------------------------------------------
# GCS Storage Bucket (AI Agent Workspace Storage)
#---------------------------------------------------------
resource "google_storage_bucket" "agent_bucket" {
  name                        = "enterprise-agent-workspace-${var.environment}"
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }
}

#---------------------------------------------------------
# IAM Service Account for Agent Runtime
#---------------------------------------------------------
resource "google_service_account" "agent_sa" {
  account_id   = "agent-engine-sa"
  display_name = "Service Account for running AI Agent Engine on Cloud Run"
}

# Grant Storage Access to Agent SA
resource "google_storage_bucket_iam_member" "agent_storage_access" {
  bucket = google_storage_bucket.agent_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.agent_sa.email}"
}

# Grant Trace Agent role to Agent SA (for OpenTelemetry tracing)
resource "google_project_iam_member" "agent_trace_access" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.agent_sa.email}"
}

#---------------------------------------------------------
# Serverless Container: Google Cloud Run (App Backend)
#---------------------------------------------------------
resource "google_cloud_run_v2_service" "app" {
  name     = "cloudrun-app-enterprise-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}/app-backend:latest"
      ports {
        container_port = 8080
      }
    }
    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }
  }
}

#---------------------------------------------------------
# Serverless Container: AI Agent Engine on Cloud Run
#---------------------------------------------------------
resource "google_cloud_run_v2_service" "agent_engine" {
  name     = "cloudrun-agent-engine-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.agent_sa.email
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}/agent-engine:latest"
      ports {
        container_port = 8080
      }
      env {
        name  = "ENABLE_TRACING"
        value = "true"
      }
      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.redis.host
      }
      env {
        name  = "AGENT_WORKSPACE_BUCKET"
        value = google_storage_bucket.agent_bucket.name
      }
    }
    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }
  }

  depends_on = [
    google_project_service.trace,
    google_project_service.monitoring
  ]
}
