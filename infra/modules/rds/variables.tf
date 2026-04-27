variable "environment" {
  description = "Deployment environment name (e.g. staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC in which to place the RDS instance"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for the DB subnet group"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID of ECS tasks — granted inbound 5432 access"
  type        = string
}

variable "db_name" {
  description = "Name of the initial database to create"
  type        = string
  default     = "finance"
}

variable "db_username" {
  description = "Master username for the RDS instance"
  type        = string
  default     = "finance_admin"
}

variable "db_password" {
  description = "Master password for the RDS instance. Set via CLI after apply — do not hardcode"
  type        = string
  sensitive   = true
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "Initial allocated storage in GiB"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Upper limit for RDS storage autoscaling in GiB"
  type        = number
  default     = 100
}
