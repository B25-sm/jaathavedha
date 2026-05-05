# Variables for S3 replication configuration

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "primary_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "Secondary AWS region for replication"
  type        = string
  default     = "us-west-2"
}

variable "enable_replication_time_control" {
  description = "Enable S3 Replication Time Control (RTC) for predictable replication"
  type        = bool
  default     = true
}

variable "replication_time_minutes" {
  description = "Target replication time in minutes"
  type        = number
  default     = 15
}

variable "content_bucket_lifecycle_enabled" {
  description = "Enable lifecycle policies for content bucket"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of days to retain backups before deletion"
  type        = number
  default     = 365
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
