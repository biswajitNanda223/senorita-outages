terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.30.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_availability_zones" "available" {}

#---------------------------------------------------------
# Networking: VPC & Subnets
#---------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "vpc-enterprise-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "igw-${var.environment}"
  }
}

# Subnets
resource "aws_subnet" "public_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  tags = {
    Name = "subnet-public-1-${var.environment}"
  }
}

resource "aws_subnet" "public_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true
  tags = {
    Name = "subnet-public-2-${var.environment}"
  }
}

resource "aws_subnet" "private_app_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  tags = {
    Name = "subnet-private-app-1-${var.environment}"
  }
}

resource "aws_subnet" "private_app_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]
  tags = {
    Name = "subnet-private-app-2-${var.environment}"
  }
}

resource "aws_subnet" "private_db_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.20.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  tags = {
    Name = "subnet-private-db-1-${var.environment}"
  }
}

resource "aws_subnet" "private_db_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.21.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]
  tags = {
    Name = "subnet-private-db-2-${var.environment}"
  }
}

# Elastic IPs & NAT Gateways
resource "aws_eip" "nat_1" {
  domain = "vpc"
}

resource "aws_nat_gateway" "nat_gw_1" {
  allocation_id = aws_eip.nat_1.id
  subnet_id     = aws_subnet.public_1.id
  tags = {
    Name = "nat-gw-1-${var.environment}"
  }
}

# Routing Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "rt-public-${var.environment}"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat_gw_1.id
  }

  tags = {
    Name = "rt-private-${var.environment}"
  }
}

# Associations
resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_1" {
  subnet_id      = aws_subnet.private_app_1.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_2" {
  subnet_id      = aws_subnet.private_app_2.id
  route_table_id = aws_route_table.private.id
}

#---------------------------------------------------------
# SSO: AWS Cognito User Pool
#---------------------------------------------------------
resource "aws_cognito_user_pool" "pool" {
  name = var.cognito_user_pool_name

  alias_attributes         = ["email", "preferred_username"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }
}

resource "aws_cognito_user_pool_client" "client" {
  name         = "enterprise-app-client"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret              = true
  allowed_oauth_flows          = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes         = ["openid", "profile", "email"]
  callback_urls = [
    "https://app.example.com/login/oauth2/code/cognito",
    "http://localhost:8080/login/oauth2/code/cognito"
  ]
}

#---------------------------------------------------------
# Container Registry (ECR)
#---------------------------------------------------------
resource "aws_ecr_repository" "repo" {
  name                 = "enterprise-ecr-${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Environment = var.environment
  }
}

#---------------------------------------------------------
# Compute: Amazon EKS Cluster (Private Nodes)
#---------------------------------------------------------
resource "aws_iam_role" "eks_cluster" {
  name = "eks-cluster-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_eks_cluster" "eks" {
  name     = "eks-enterprise-${var.environment}"
  role_arn = aws_iam_role.eks_cluster.arn

  vpc_config {
    subnet_ids              = [aws_subnet.private_app_1.id, aws_subnet.private_app_2.id]
    endpoint_private_access = true
    endpoint_public_access  = false # Secure cluster
  }

  depends_on = [aws_iam_role_policy_attachment.eks_cluster_policy]
}

#---------------------------------------------------------
# Compute: Amazon ECS Fargate
#---------------------------------------------------------
resource "aws_ecs_cluster" "ecs" {
  name = "ecs-enterprise-${var.environment}"
}

#---------------------------------------------------------
# Relational DB: RDS PostgreSQL Multi-AZ
#---------------------------------------------------------
resource "aws_db_subnet_group" "db_subnets" {
  name       = "db-subnet-group-${var.environment}"
  subnet_ids = [aws_subnet.private_db_1.id, aws_subnet.private_db_2.id]
}

resource "aws_security_group" "db_sg" {
  name   = "db-security-group-${var.environment}"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "rds-postgres-enterprise"
  allocated_storage      = 20
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = "db.t4g.micro"
  username               = "dbadmin"
  password               = "SuperSecretPassword123!" # In production, pull from Secrets Manager
  db_subnet_group_name   = aws_db_subnet_group.db_subnets.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  multi_az               = true
  skip_final_snapshot    = true
}

#---------------------------------------------------------
# Amazon ElastiCache Redis
#---------------------------------------------------------
resource "aws_elasticache_subnet_group" "redis_subnets" {
  name       = "redis-subnet-group-${var.environment}"
  subnet_ids = [aws_subnet.private_db_1.id, aws_subnet.private_db_2.id]
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id        = "redis-cluster-${var.environment}"
  description                 = "Enterprise ElastiCache Cluster"
  node_type                   = "cache.t4g.micro"
  num_cache_clusters          = 2
  parameter_group_name        = "default.redis7"
  port                        = 6379
  subnet_group_name           = aws_elasticache_subnet_group.redis_subnets.name
  security_group_ids          = [aws_security_group.db_sg.id] # Sharing db security group for simplicity
  automatic_failover_enabled  = true
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
}
