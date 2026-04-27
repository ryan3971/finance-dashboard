variable "environment" {
  description = "Deployment environment name (e.g. staging, prod)"
  type        = string
}

variable "account_id" {
  description = "AWS account ID — used to construct globally unique bucket names"
  type        = string
}

variable "frontend_bucket_name" {
  description = "Name of the S3 bucket serving the frontend SPA (e.g. finance-frontend-<account_id>)"
  type        = string
}

variable "uploads_bucket_name" {
  description = "Name of the S3 bucket for user-uploaded files (e.g. finance-uploads-<account_id>)"
  type        = string
}
