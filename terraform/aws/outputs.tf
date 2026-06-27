output "vpc_id" {
  description = "The ID of the VPC."
  value       = aws_vpc.main.id
}

output "ecr_repository_url" {
  description = "The URL of the ECR repository."
  value       = aws_ecr_repository.repo.repository_url
}

output "eks_cluster_name" {
  description = "The EKS cluster name."
  value       = aws_eks_cluster.eks.name
}

output "eks_endpoint" {
  description = "The endpoint URL of the private EKS cluster API."
  value       = aws_eks_cluster.eks.endpoint
}

output "cognito_user_pool_id" {
  description = "The Cognito User Pool ID."
  value       = aws_cognito_user_pool.pool.id
}

output "cognito_client_id" {
  description = "The Cognito App Client ID."
  value       = aws_cognito_user_pool_client.client.id
}

output "cognito_client_secret" {
  description = "The Cognito App Client Secret."
  value       = aws_cognito_user_pool_client.client.client_secret
  sensitive   = true
}

output "rds_endpoint" {
  description = "The connection endpoint for the RDS PostgreSQL database."
  value       = aws_db_instance.postgres.endpoint
}

output "redis_primary_endpoint" {
  description = "The primary connection endpoint for the Redis cache replication group."
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}
