output "frontend_bucket_name" {
  description = "Name of the frontend SPA bucket"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_bucket_arn" {
  description = "ARN of the frontend SPA bucket"
  value       = aws_s3_bucket.frontend.arn
}

output "uploads_bucket_name" {
  description = "Name of the user-uploads bucket"
  value       = aws_s3_bucket.uploads.bucket
}

output "uploads_bucket_arn" {
  description = "ARN of the user-uploads bucket"
  value       = aws_s3_bucket.uploads.arn
}
