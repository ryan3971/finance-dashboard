variable "environment" {
  description = "Deployment environment name (e.g. staging, prod)"
  type        = string
}

variable "frontend_bucket_name" {
  description = "Name of the S3 bucket serving the frontend SPA"
  type        = string
}

variable "frontend_bucket_arn" {
  description = "ARN of the S3 bucket serving the frontend SPA"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN (must be in us-east-1 for CloudFront)"
  type        = string
}

variable "domain_name" {
  description = "Custom domain name for the CloudFront distribution (e.g. app.ryantyrrell.ca)"
  type        = string
}
