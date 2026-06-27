variable "project_id" {
  description = "The Google Cloud Project ID."
  type        = string
  default     = "enterprise-devops-project"
}

variable "region" {
  description = "The GCP region to deploy resources."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "The deployment environment name."
  type        = string
  default     = "dev"
}

variable "vpc_name" {
  description = "The name of the GCP VPC network."
  type        = string
  default     = "vpc-enterprise"
}
