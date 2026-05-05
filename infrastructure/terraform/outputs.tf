# Main Terraform Outputs

# VPC Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

# EKS Outputs
output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_certificate_authority_data" {
  description = "EKS cluster certificate authority data"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_oidc_provider_arn" {
  description = "ARN of the OIDC provider for EKS"
  value       = module.eks.oidc_provider_arn
}

# RDS Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
}

output "rds_database_name" {
  description = "RDS database name"
  value       = module.rds.db_name
}

output "rds_password_secret_arn" {
  description = "ARN of the secret containing RDS password"
  value       = module.rds.db_password_secret_arn
}

# Redis Outputs
output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = module.redis.redis_endpoint
}

output "redis_port" {
  description = "Redis port"
  value       = module.redis.redis_port
}

output "redis_auth_token_secret_arn" {
  description = "ARN of the secret containing Redis auth token"
  value       = module.redis.redis_auth_token_secret_arn
}

# S3 Outputs
output "content_bucket_id" {
  description = "Content S3 bucket ID"
  value       = module.s3.content_bucket_id
}

output "user_uploads_bucket_id" {
  description = "User uploads S3 bucket ID"
  value       = module.s3.user_uploads_bucket_id
}

output "backups_bucket_id" {
  description = "Backups S3 bucket ID"
  value       = module.s3.backups_bucket_id
}

# CloudFront Outputs
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cloudfront.distribution_domain_name
}

# ALB Outputs
output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "ALB zone ID"
  value       = module.alb.alb_zone_id
}

output "api_target_group_arn" {
  description = "Target group ARN for API Gateway"
  value       = module.alb.target_group_arn
}

# Connection Information
output "kubectl_config_command" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

output "database_connection_string" {
  description = "Database connection string (password in Secrets Manager)"
  value       = "postgresql://${module.rds.db_username}@${module.rds.db_instance_address}:${module.rds.db_instance_port}/${module.rds.db_name}"
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string (auth token in Secrets Manager)"
  value       = "rediss://${module.redis.redis_endpoint}:${module.redis.redis_port}"
  sensitive   = true
}
