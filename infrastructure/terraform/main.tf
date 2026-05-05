# Sai Mahendra Platform Infrastructure
# This Terraform configuration sets up the AWS infrastructure for the platform

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
  }

  backend "s3" {
    bucket = "sai-mahendra-terraform-state"
    key    = "platform/terraform.tfstate"
    region = "us-east-1"
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "sai-mahendra-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Local values
locals {
  cluster_name = "sai-mahendra-${var.environment}"
  
  common_tags = {
    Project     = "sai-mahendra-platform"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# VPC Configuration
module "vpc" {
  source = "./modules/vpc"
  
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  
  availability_zones = data.aws_availability_zones.available.names
  
  tags = local.common_tags
}

# EKS Cluster
module "eks" {
  source = "./modules/eks"
  
  cluster_name       = local.cluster_name
  cluster_version    = var.kubernetes_version
  environment        = var.environment
  
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  
  node_groups = var.node_groups
  
  tags = local.common_tags
}

# RDS PostgreSQL
module "rds" {
  source = "./modules/rds"
  
  environment = var.environment
  
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  
  instance_class     = var.rds_instance_class
  allocated_storage  = var.rds_allocated_storage
  
  database_name      = var.database_name
  master_username    = var.database_username
  
  tags = local.common_tags
}

# ElastiCache Redis
module "redis" {
  source = "./modules/redis"
  
  environment = var.environment
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  
  node_type           = var.redis_node_type
  num_cache_nodes     = var.redis_num_nodes
  
  tags = local.common_tags
}

# S3 Buckets
module "s3" {
  source = "./modules/s3"
  
  environment = var.environment
  
  tags = local.common_tags
}

# CloudFront CDN
module "cloudfront" {
  source = "./modules/cloudfront"
  
  environment = var.environment
  
  s3_bucket_domain_name = module.s3.content_bucket_domain_name
  
  tags = local.common_tags
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"
  
  environment = var.environment
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnet_ids
  
  certificate_arn = var.ssl_certificate_arn
  
  tags = local.common_tags
}