variable "environment" {
  description = "Deployment environment name (e.g. staging, prod)"
  type        = string
}

variable "parameter_prefix" {
  description = "SSM parameter path prefix (e.g. /finance)"
  type        = string
  default     = "/finance"
}
