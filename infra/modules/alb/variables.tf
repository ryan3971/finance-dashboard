variable "environment" {
  description = "Deployment environment name (e.g. staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC in which to place the ALB"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs across which the ALB is distributed"
  type        = list(string)
}

variable "certificate_arn" {
  description = "ACM certificate ARN — leave empty until domain is purchased"
  type        = string
  default     = ""
}
