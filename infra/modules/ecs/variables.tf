variable "environment" {
  description = "Deployment environment name (e.g. staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC in which to place ECS tasks"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs in which ECS tasks run"
  type        = list(string)
}

variable "target_group_arn" {
  description = "ARN of the ALB target group that receives traffic for the ECS service"
  type        = string
}

variable "alb_security_group_id" {
  description = "Security group ID of the ALB — granted egress to ECS tasks on app_port"
  type        = string
}

variable "rds_security_group_id" {
  description = "Security group ID of the RDS instance — granted ingress from ECS tasks on port 5432"
  type        = string
}

variable "ecr_repository_url" {
  description = "ECR repository URL (without tag) for the finance-api image"
  type        = string
}

variable "uploads_bucket_arn" {
  description = "ARN of the S3 uploads bucket — granted to the ECS task role for presigned URL operations"
  type        = string
}

variable "ssm_db_url_arn" {
  description = "ARN of the SSM parameter holding the database URL"
  type        = string
}

variable "ssm_jwt_secret_arn" {
  description = "ARN of the SSM parameter holding the JWT secret"
  type        = string
}

variable "ssm_anthropic_key_arn" {
  description = "ARN of the SSM parameter holding the Anthropic API key"
  type        = string
}

variable "ssm_openai_key_arn" {
  description = "ARN of the SSM parameter holding the OpenAI API key"
  type        = string
}

variable "ssm_sentry_dsn_arn" {
  description = "ARN of the SSM parameter holding the Sentry DSN"
  type        = string
}

variable "cpu" {
  description = "Fargate task CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Fargate task memory in MiB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of running ECS tasks"
  type        = number
  default     = 1
}

variable "app_port" {
  description = "Port the API container listens on"
  type        = number
  default     = 3000
}
