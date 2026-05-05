# S3 Module Outputs

output "content_bucket_id" {
  description = "Content bucket ID"
  value       = aws_s3_bucket.content.id
}

output "content_bucket_arn" {
  description = "Content bucket ARN"
  value       = aws_s3_bucket.content.arn
}

output "content_bucket_domain_name" {
  description = "Content bucket domain name"
  value       = aws_s3_bucket.content.bucket_regional_domain_name
}

output "user_uploads_bucket_id" {
  description = "User uploads bucket ID"
  value       = aws_s3_bucket.user_uploads.id
}

output "user_uploads_bucket_arn" {
  description = "User uploads bucket ARN"
  value       = aws_s3_bucket.user_uploads.arn
}

output "backups_bucket_id" {
  description = "Backups bucket ID"
  value       = aws_s3_bucket.backups.id
}

output "backups_bucket_arn" {
  description = "Backups bucket ARN"
  value       = aws_s3_bucket.backups.arn
}

output "logs_bucket_id" {
  description = "Logs bucket ID"
  value       = aws_s3_bucket.logs.id
}

output "logs_bucket_arn" {
  description = "Logs bucket ARN"
  value       = aws_s3_bucket.logs.arn
}

output "kms_key_id" {
  description = "KMS key ID for S3 encryption"
  value       = aws_kms_key.s3.id
}

output "kms_key_arn" {
  description = "KMS key ARN for S3 encryption"
  value       = aws_kms_key.s3.arn
}
