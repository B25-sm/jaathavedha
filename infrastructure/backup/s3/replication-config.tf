# S3 Cross-Region Replication Configuration
# This Terraform configuration sets up cross-region replication for S3 buckets

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary region provider (us-east-1)
provider "aws" {
  alias  = "primary"
  region = "us-east-1"
}

# Secondary region provider (us-west-2)
provider "aws" {
  alias  = "secondary"
  region = "us-west-2"
}

# Local variables
locals {
  bucket_prefix = "sai-mahendra"
  environment   = var.environment
  
  common_tags = {
    Project     = "sai-mahendra-platform"
    Environment = var.environment
    ManagedBy   = "terraform"
    Component   = "backup-replication"
  }
}

# IAM role for S3 replication
resource "aws_iam_role" "replication" {
  provider = aws.primary
  name     = "${local.bucket_prefix}-s3-replication-role-${local.environment}"

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

  tags = local.common_tags
}

# IAM policy for S3 replication
resource "aws_iam_role_policy" "replication" {
  provider = aws.primary
  name     = "${local.bucket_prefix}-s3-replication-policy-${local.environment}"
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
          aws_s3_bucket.primary_content.arn,
          aws_s3_bucket.primary_backups.arn
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
          "${aws_s3_bucket.primary_content.arn}/*",
          "${aws_s3_bucket.primary_backups.arn}/*"
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
          "${aws_s3_bucket.secondary_content.arn}/*",
          "${aws_s3_bucket.secondary_backups.arn}/*"
        ]
      }
    ]
  })
}

# KMS key for encryption in primary region
resource "aws_kms_key" "primary" {
  provider                = aws.primary
  description             = "KMS key for S3 bucket encryption in primary region"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.bucket_prefix}-s3-kms-primary-${local.environment}"
  })
}

resource "aws_kms_alias" "primary" {
  provider      = aws.primary
  name          = "alias/${local.bucket_prefix}-s3-primary-${local.environment}"
  target_key_id = aws_kms_key.primary.key_id
}

# KMS key for encryption in secondary region
resource "aws_kms_key" "secondary" {
  provider                = aws.secondary
  description             = "KMS key for S3 bucket encryption in secondary region"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.bucket_prefix}-s3-kms-secondary-${local.environment}"
  })
}

resource "aws_kms_alias" "secondary" {
  provider      = aws.secondary
  name          = "alias/${local.bucket_prefix}-s3-secondary-${local.environment}"
  target_key_id = aws_kms_key.secondary.key_id
}

# Primary Content Bucket (us-east-1)
resource "aws_s3_bucket" "primary_content" {
  provider = aws.primary
  bucket   = "${local.bucket_prefix}-content-${local.environment}"

  tags = merge(local.common_tags, {
    Name = "${local.bucket_prefix}-content-primary-${local.environment}"
    Type = "content"
  })
}

# Enable versioning on primary content bucket
resource "aws_s3_bucket_versioning" "primary_content" {
  provider = aws.primary
  bucket   = aws_s3_bucket.primary_content.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption on primary content bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "primary_content" {
  provider = aws.primary
  bucket   = aws_s3_bucket.primary_content.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.primary.arn
    }
    bucket_key_enabled = true
  }
}

# Secondary Content Bucket (us-west-2)
resource "aws_s3_bucket" "secondary_content" {
  provider = aws.secondary
  bucket   = "${local.bucket_prefix}-content-replica-${local.environment}"

  tags = merge(local.common_tags, {
    Name = "${local.bucket_prefix}-content-secondary-${local.environment}"
    Type = "content-replica"
  })
}

# Enable versioning on secondary content bucket
resource "aws_s3_bucket_versioning" "secondary_content" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.secondary_content.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption on secondary content bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "secondary_content" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.secondary_content.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.secondary.arn
    }
    bucket_key_enabled = true
  }
}

# Replication configuration for content bucket
resource "aws_s3_bucket_replication_configuration" "content" {
  provider = aws.primary
  
  depends_on = [
    aws_s3_bucket_versioning.primary_content,
    aws_s3_bucket_versioning.secondary_content
  ]

  role   = aws_iam_role.replication.arn
  bucket = aws_s3_bucket.primary_content.id

  rule {
    id     = "replicate-all-content"
    status = "Enabled"

    filter {}

    destination {
      bucket        = aws_s3_bucket.secondary_content.arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = aws_kms_key.secondary.arn
      }

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

# Primary Backups Bucket (us-east-1)
resource "aws_s3_bucket" "primary_backups" {
  provider = aws.primary
  bucket   = "${local.bucket_prefix}-backups-${local.environment}"

  tags = merge(local.common_tags, {
    Name = "${local.bucket_prefix}-backups-primary-${local.environment}"
    Type = "backups"
  })
}

# Enable versioning on primary backups bucket
resource "aws_s3_bucket_versioning" "primary_backups" {
  provider = aws.primary
  bucket   = aws_s3_bucket.primary_backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption on primary backups bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "primary_backups" {
  provider = aws.primary
  bucket   = aws_s3_bucket.primary_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.primary.arn
    }
    bucket_key_enabled = true
  }
}

# Lifecycle policy for primary backups bucket
resource "aws_s3_bucket_lifecycle_configuration" "primary_backups" {
  provider = aws.primary
  bucket   = aws_s3_bucket.primary_backups.id

  rule {
    id     = "transition-old-backups"
    status = "Enabled"

    transition {
      days          = 7
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 30
      storage_class = "GLACIER_IR"
    }

    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = 365
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Secondary Backups Bucket (us-west-2)
resource "aws_s3_bucket" "secondary_backups" {
  provider = aws.secondary
  bucket   = "${local.bucket_prefix}-backups-replica-${local.environment}"

  tags = merge(local.common_tags, {
    Name = "${local.bucket_prefix}-backups-secondary-${local.environment}"
    Type = "backups-replica"
  })
}

# Enable versioning on secondary backups bucket
resource "aws_s3_bucket_versioning" "secondary_backups" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.secondary_backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption on secondary backups bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "secondary_backups" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.secondary_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.secondary.arn
    }
    bucket_key_enabled = true
  }
}

# Lifecycle policy for secondary backups bucket
resource "aws_s3_bucket_lifecycle_configuration" "secondary_backups" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.secondary_backups.id

  rule {
    id     = "transition-old-backups"
    status = "Enabled"

    transition {
      days          = 7
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 30
      storage_class = "GLACIER_IR"
    }

    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = 365
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Replication configuration for backups bucket
resource "aws_s3_bucket_replication_configuration" "backups" {
  provider = aws.primary
  
  depends_on = [
    aws_s3_bucket_versioning.primary_backups,
    aws_s3_bucket_versioning.secondary_backups
  ]

  role   = aws_iam_role.replication.arn
  bucket = aws_s3_bucket.primary_backups.id

  rule {
    id     = "replicate-all-backups"
    status = "Enabled"

    filter {}

    destination {
      bucket        = aws_s3_bucket.secondary_backups.arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = aws_kms_key.secondary.arn
      }

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

# Block public access for all buckets
resource "aws_s3_bucket_public_access_block" "primary_content" {
  provider = aws.primary
  bucket   = aws_s3_bucket.primary_content.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "secondary_content" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.secondary_content.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "primary_backups" {
  provider = aws.primary
  bucket   = aws_s3_bucket.primary_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "secondary_backups" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.secondary_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Outputs
output "primary_content_bucket" {
  description = "Primary content bucket name"
  value       = aws_s3_bucket.primary_content.id
}

output "secondary_content_bucket" {
  description = "Secondary content bucket name"
  value       = aws_s3_bucket.secondary_content.id
}

output "primary_backups_bucket" {
  description = "Primary backups bucket name"
  value       = aws_s3_bucket.primary_backups.id
}

output "secondary_backups_bucket" {
  description = "Secondary backups bucket name"
  value       = aws_s3_bucket.secondary_backups.id
}

output "replication_role_arn" {
  description = "IAM role ARN for S3 replication"
  value       = aws_iam_role.replication.arn
}
