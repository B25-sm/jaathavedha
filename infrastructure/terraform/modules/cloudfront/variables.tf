# CloudFront Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "s3_bucket_domain_name" {
  description = "S3 bucket domain name for CloudFront origin"
  type        = string
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
