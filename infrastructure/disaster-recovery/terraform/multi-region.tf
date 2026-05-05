# Multi-Region Disaster Recovery Infrastructure
# This configuration deploys infrastructure across primary and secondary regions

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary Region Provider (us-east-1)
provider "aws" {
  alias  = "primary"
  region = var.primary_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "sai-mahendra-platform"
      ManagedBy   = "terraform"
      DR          = "primary"
    }
  }
}

# Secondary Region Provider (us-west-2)
provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "sai-mahendra-platform"
      ManagedBy   = "terraform"
      DR          = "secondary"
    }
  }
}

# ============================================================================
# PRIMARY REGION RESOURCES
# ============================================================================

# VPC for Primary Region
module "primary_vpc" {
  source = "../modules/vpc"
  providers = {
    aws = aws.primary
  }
  
  vpc_name            = "sai-mahendra-primary-vpc"
  vpc_cidr            = var.primary_vpc_cidr
  availability_zones  = var.primary_azs
  enable_nat_gateway  = true
  enable_vpn_gateway  = false
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Region = "primary"
  }
}

# EKS Cluster for Primary Region
module "primary_eks" {
  source = "../modules/eks"
  providers = {
    aws = aws.primary
  }
  
  cluster_name    = "sai-mahendra-primary-cluster"
  cluster_version = var.kubernetes_version
  vpc_id          = module.primary_vpc.vpc_id
  subnet_ids      = module.primary_vpc.private_subnet_ids
  
  node_groups = {
    critical = {
      desired_size = 3
      min_size     = 3
      max_size     = 10
      instance_types = ["t3.large"]
      labels = {
        tier = "critical"
      }
    }
    general = {
      desired_size = 2
      min_size     = 2
      max_size     = 8
      instance_types = ["t3.medium"]
      labels = {
        tier = "general"
      }
    }
  }
  
  tags = {
    Region = "primary"
  }
}

# RDS Primary Instance (Multi-AZ)
module "primary_rds" {
  source = "../modules/rds"
  providers = {
    aws = aws.primary
  }
  
  identifier     = "sai-mahendra-primary-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.rds_instance_class
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.primary_rds.arn
  
  db_name  = "saimahendra"
  username = var.db_username
  password = var.db_password
  
  multi_az               = true
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  vpc_id             = module.primary_vpc.vpc_id
  subnet_ids         = module.primary_vpc.database_subnet_ids
  
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  # Enable automated backups to S3
  backup_target = "region"
  
  tags = {
    Region = "primary"
    Tier   = "critical"
  }
}

# Redis Primary Cluster
module "primary_redis" {
  source = "../modules/redis"
  providers = {
    aws = aws.primary
  }
  
  cluster_id           = "sai-mahendra-primary-redis"
  engine_version       = "7.0"
  node_type            = var.redis_node_type
  num_cache_nodes      = 3
  parameter_group_name = "default.redis7"
  
  subnet_ids         = module.primary_vpc.cache_subnet_ids
  security_group_ids = [aws_security_group.primary_redis.id]
  
  # Enable automatic failover
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  # Snapshot configuration
  snapshot_retention_limit = 7
  snapshot_window         = "05:00-06:00"
  
  # Enable at-rest encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = var.redis_auth_token
  
  tags = {
    Region = "primary"
    Tier   = "critical"
  }
}

# S3 Bucket for Primary Region
resource "aws_s3_bucket" "primary" {
  provider = aws.primary
  bucket   = "sai-mahendra-primary-${var.environment}"
  
  tags = {
    Region = "primary"
  }
}

resource "aws_s3_bucket_versioning" "primary" {
  provider = aws.primary
  bucket   = aws_s3_bucket.primary.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "primary" {
  provider = aws.primary
  bucket   = aws_s3_bucket.primary.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.primary_s3.arn
    }
  }
}

# ============================================================================
# SECONDARY REGION RESOURCES (Disaster Recovery)
# ============================================================================

# VPC for Secondary Region
module "secondary_vpc" {
  source = "../modules/vpc"
  providers = {
    aws = aws.secondary
  }
  
  vpc_name            = "sai-mahendra-secondary-vpc"
  vpc_cidr            = var.secondary_vpc_cidr
  availability_zones  = var.secondary_azs
  enable_nat_gateway  = true
  enable_vpn_gateway  = false
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Region = "secondary"
  }
}

# EKS Cluster for Secondary Region (Warm Standby)
module "secondary_eks" {
  source = "../modules/eks"
  providers = {
    aws = aws.secondary
  }
  
  cluster_name    = "sai-mahendra-secondary-cluster"
  cluster_version = var.kubernetes_version
  vpc_id          = module.secondary_vpc.vpc_id
  subnet_ids      = module.secondary_vpc.private_subnet_ids
  
  # Smaller node groups for warm standby
  node_groups = {
    critical = {
      desired_size = 2
      min_size     = 2
      max_size     = 10
      instance_types = ["t3.large"]
      labels = {
        tier = "critical"
      }
    }
    general = {
      desired_size = 1
      min_size     = 1
      max_size     = 8
      instance_types = ["t3.medium"]
      labels = {
        tier = "general"
      }
    }
  }
  
  tags = {
    Region = "secondary"
  }
}

# RDS Read Replica in Secondary Region
resource "aws_db_instance" "secondary_replica" {
  provider = aws.secondary
  
  identifier             = "sai-mahendra-secondary-replica"
  replicate_source_db    = module.primary_rds.db_instance_arn
  instance_class         = var.rds_instance_class
  
  # Can be promoted to standalone
  backup_retention_period = 7
  
  # Enable automated backups for promotion capability
  skip_final_snapshot = false
  final_snapshot_identifier = "sai-mahendra-secondary-final-snapshot"
  
  # Performance Insights
  performance_insights_enabled = true
  
  tags = {
    Region = "secondary"
    Tier   = "critical"
    Role   = "read-replica"
  }
}

# Redis Replica in Secondary Region
module "secondary_redis" {
  source = "../modules/redis"
  providers = {
    aws = aws.secondary
  }
  
  cluster_id           = "sai-mahendra-secondary-redis"
  engine_version       = "7.0"
  node_type            = var.redis_node_type
  num_cache_nodes      = 2
  parameter_group_name = "default.redis7"
  
  subnet_ids         = module.secondary_vpc.cache_subnet_ids
  security_group_ids = [aws_security_group.secondary_redis.id]
  
  # Enable automatic failover
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  # Snapshot configuration
  snapshot_retention_limit = 7
  snapshot_window         = "05:00-06:00"
  
  # Enable encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = var.redis_auth_token
  
  tags = {
    Region = "secondary"
    Tier   = "critical"
    Role   = "replica"
  }
}

# S3 Bucket for Secondary Region
resource "aws_s3_bucket" "secondary" {
  provider = aws.secondary
  bucket   = "sai-mahendra-secondary-${var.environment}"
  
  tags = {
    Region = "secondary"
  }
}

resource "aws_s3_bucket_versioning" "secondary" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.secondary.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "secondary" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.secondary.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.secondary_s3.arn
    }
  }
}

# ============================================================================
# CROSS-REGION REPLICATION
# ============================================================================

# S3 Cross-Region Replication
resource "aws_s3_bucket_replication_configuration" "primary_to_secondary" {
  provider = aws.primary
  
  depends_on = [aws_s3_bucket_versioning.primary]
  
  role   = aws_iam_role.replication.arn
  bucket = aws_s3_bucket.primary.id
  
  rule {
    id     = "replicate-all"
    status = "Enabled"
    
    filter {}
    
    destination {
      bucket        = aws_s3_bucket.secondary.arn
      storage_class = "STANDARD_IA"
      
      # Enable replication time control for predictable replication
      replication_time {
        status = "Enabled"
        time {
          minutes = 15
        }
      }
      
      metrics {
        status = "Enabled"
        event_threshold {
          minutes = 15
        }
      }
    }
    
    delete_marker_replication {
      status = "Enabled"
    }
  }
}

# IAM Role for S3 Replication
resource "aws_iam_role" "replication" {
  provider = aws.primary
  name     = "s3-replication-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "replication" {
  provider = aws.primary
  role     = aws_iam_role.replication.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Effect = "Allow"
        Resource = [
          aws_s3_bucket.primary.arn
        ]
      },
      {
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Effect = "Allow"
        Resource = [
          "${aws_s3_bucket.primary.arn}/*"
        ]
      },
      {
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Effect = "Allow"
        Resource = [
          "${aws_s3_bucket.secondary.arn}/*"
        ]
      }
    ]
  })
}

# ============================================================================
# ROUTE 53 HEALTH CHECKS AND FAILOVER
# ============================================================================

# Route 53 Hosted Zone
resource "aws_route53_zone" "main" {
  provider = aws.primary
  name     = var.domain_name
  
  tags = {
    Environment = var.environment
  }
}

# Health Check for Primary Region
resource "aws_route53_health_check" "primary" {
  provider          = aws.primary
  fqdn              = module.primary_alb.dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30
  measure_latency   = true
  
  tags = {
    Name   = "primary-region-health-check"
    Region = "primary"
  }
}

# Health Check for Secondary Region
resource "aws_route53_health_check" "secondary" {
  provider          = aws.secondary
  fqdn              = module.secondary_alb.dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30
  measure_latency   = true
  
  tags = {
    Name   = "secondary-region-health-check"
    Region = "secondary"
  }
}

# Primary Region DNS Record (Failover Primary)
resource "aws_route53_record" "primary" {
  provider = aws.primary
  zone_id  = aws_route53_zone.main.zone_id
  name     = "api.${var.domain_name}"
  type     = "A"
  
  set_identifier = "primary"
  
  failover_routing_policy {
    type = "PRIMARY"
  }
  
  health_check_id = aws_route53_health_check.primary.id
  
  alias {
    name                   = module.primary_alb.dns_name
    zone_id                = module.primary_alb.zone_id
    evaluate_target_health = true
  }
}

# Secondary Region DNS Record (Failover Secondary)
resource "aws_route53_record" "secondary" {
  provider = aws.secondary
  zone_id  = aws_route53_zone.main.zone_id
  name     = "api.${var.domain_name}"
  type     = "A"
  
  set_identifier = "secondary"
  
  failover_routing_policy {
    type = "SECONDARY"
  }
  
  alias {
    name                   = module.secondary_alb.dns_name
    zone_id                = module.secondary_alb.zone_id
    evaluate_target_health = true
  }
}

# ============================================================================
# APPLICATION LOAD BALANCERS
# ============================================================================

# Primary Region ALB
module "primary_alb" {
  source = "../modules/alb"
  providers = {
    aws = aws.primary
  }
  
  name               = "sai-mahendra-primary-alb"
  vpc_id             = module.primary_vpc.vpc_id
  subnet_ids         = module.primary_vpc.public_subnet_ids
  security_group_ids = [aws_security_group.primary_alb.id]
  
  enable_deletion_protection = true
  enable_http2              = true
  enable_cross_zone_load_balancing = true
  
  tags = {
    Region = "primary"
  }
}

# Secondary Region ALB
module "secondary_alb" {
  source = "../modules/alb"
  providers = {
    aws = aws.secondary
  }
  
  name               = "sai-mahendra-secondary-alb"
  vpc_id             = module.secondary_vpc.vpc_id
  subnet_ids         = module.secondary_vpc.public_subnet_ids
  security_group_ids = [aws_security_group.secondary_alb.id]
  
  enable_deletion_protection = true
  enable_http2              = true
  enable_cross_zone_load_balancing = true
  
  tags = {
    Region = "secondary"
  }
}

# ============================================================================
# KMS KEYS FOR ENCRYPTION
# ============================================================================

# Primary Region KMS Keys
resource "aws_kms_key" "primary_rds" {
  provider                = aws.primary
  description             = "KMS key for RDS encryption in primary region"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = true
  
  tags = {
    Name   = "sai-mahendra-primary-rds-key"
    Region = "primary"
  }
}

resource "aws_kms_key" "primary_s3" {
  provider                = aws.primary
  description             = "KMS key for S3 encryption in primary region"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = true
  
  tags = {
    Name   = "sai-mahendra-primary-s3-key"
    Region = "primary"
  }
}

# Secondary Region KMS Keys
resource "aws_kms_key" "secondary_s3" {
  provider                = aws.secondary
  description             = "KMS key for S3 encryption in secondary region"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = true
  
  tags = {
    Name   = "sai-mahendra-secondary-s3-key"
    Region = "secondary"
  }
}

# ============================================================================
# SECURITY GROUPS
# ============================================================================

# Primary Region Security Groups
resource "aws_security_group" "primary_alb" {
  provider    = aws.primary
  name        = "sai-mahendra-primary-alb-sg"
  description = "Security group for primary ALB"
  vpc_id      = module.primary_vpc.vpc_id
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from internet"
  }
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from internet (redirect to HTTPS)"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }
  
  tags = {
    Name   = "primary-alb-sg"
    Region = "primary"
  }
}

resource "aws_security_group" "primary_redis" {
  provider    = aws.primary
  name        = "sai-mahendra-primary-redis-sg"
  description = "Security group for primary Redis cluster"
  vpc_id      = module.primary_vpc.vpc_id
  
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.primary_eks.node_security_group_id]
    description     = "Redis from EKS nodes"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }
  
  tags = {
    Name   = "primary-redis-sg"
    Region = "primary"
  }
}

# Secondary Region Security Groups
resource "aws_security_group" "secondary_alb" {
  provider    = aws.secondary
  name        = "sai-mahendra-secondary-alb-sg"
  description = "Security group for secondary ALB"
  vpc_id      = module.secondary_vpc.vpc_id
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from internet"
  }
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from internet (redirect to HTTPS)"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }
  
  tags = {
    Name   = "secondary-alb-sg"
    Region = "secondary"
  }
}

resource "aws_security_group" "secondary_redis" {
  provider    = aws.secondary
  name        = "sai-mahendra-secondary-redis-sg"
  description = "Security group for secondary Redis cluster"
  vpc_id      = module.secondary_vpc.vpc_id
  
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.secondary_eks.node_security_group_id]
    description     = "Redis from EKS nodes"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }
  
  tags = {
    Name   = "secondary-redis-sg"
    Region = "secondary"
  }
}

# ============================================================================
# CLOUDWATCH ALARMS FOR DR MONITORING
# ============================================================================

# Primary Region Health Alarm
resource "aws_cloudwatch_metric_alarm" "primary_health" {
  provider            = aws.primary
  alarm_name          = "primary-region-health-check-failed"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "Primary region health check has failed"
  alarm_actions       = [aws_sns_topic.dr_alerts_primary.arn]
  
  dimensions = {
    HealthCheckId = aws_route53_health_check.primary.id
  }
}

# Database Replication Lag Alarm
resource "aws_cloudwatch_metric_alarm" "replication_lag" {
  provider            = aws.secondary
  alarm_name          = "database-replication-lag-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ReplicaLag"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 300  # 5 minutes
  alarm_description   = "Database replication lag exceeds 5 minutes"
  alarm_actions       = [aws_sns_topic.dr_alerts_secondary.arn]
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.secondary_replica.id
  }
}

# SNS Topics for DR Alerts
resource "aws_sns_topic" "dr_alerts_primary" {
  provider = aws.primary
  name     = "disaster-recovery-alerts-primary"
  
  tags = {
    Region = "primary"
  }
}

resource "aws_sns_topic" "dr_alerts_secondary" {
  provider = aws.secondary
  name     = "disaster-recovery-alerts-secondary"
  
  tags = {
    Region = "secondary"
  }
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "primary_region" {
  description = "Primary region configuration"
  value = {
    region              = var.primary_region
    vpc_id              = module.primary_vpc.vpc_id
    eks_cluster_name    = module.primary_eks.cluster_name
    rds_endpoint        = module.primary_rds.endpoint
    redis_endpoint      = module.primary_redis.endpoint
    alb_dns_name        = module.primary_alb.dns_name
    s3_bucket           = aws_s3_bucket.primary.id
  }
}

output "secondary_region" {
  description = "Secondary region configuration"
  value = {
    region              = var.secondary_region
    vpc_id              = module.secondary_vpc.vpc_id
    eks_cluster_name    = module.secondary_eks.cluster_name
    rds_endpoint        = aws_db_instance.secondary_replica.endpoint
    redis_endpoint      = module.secondary_redis.endpoint
    alb_dns_name        = module.secondary_alb.dns_name
    s3_bucket           = aws_s3_bucket.secondary.id
  }
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "health_check_ids" {
  description = "Route 53 health check IDs"
  value = {
    primary   = aws_route53_health_check.primary.id
    secondary = aws_route53_health_check.secondary.id
  }
}
