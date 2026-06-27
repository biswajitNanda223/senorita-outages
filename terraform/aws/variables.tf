variable "aws_region" {
  description = "The AWS Region to deploy resources."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "The deployment environment name."
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the AWS VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "cognito_user_pool_name" {
  description = "The name of the Cognito User Pool for SSO."
  type        = string
  default     = "enterprise-cognito-pool"
}
