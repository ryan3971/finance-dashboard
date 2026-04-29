variable "domain_name" {
  description = "Primary domain name for the certificate (e.g. ryantyrrell.ca)"
  type        = string
}

variable "subject_alternative_names" {
  description = "Additional domain names covered by the certificate (e.g. [\"*.ryantyrrell.ca\"])"
  type        = list(string)
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID in which DNS validation records are created"
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g. staging, prod)"
  type        = string
}
