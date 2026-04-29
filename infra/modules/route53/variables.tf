variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for ryantyrrell.ca"
  type        = string
}

variable "domain_name" {
  description = "Root domain name (e.g. ryantyrrell.ca)"
  type        = string
}

variable "cloudfront_domain_name" {
  description = "CloudFront distribution domain name — target for the app alias record"
  type        = string
}

variable "cloudfront_hosted_zone_id" {
  description = "CloudFront hosted zone ID — required for Route 53 alias records"
  type        = string
}

variable "alb_dns_name" {
  description = "ALB DNS name — target for the api alias record"
  type        = string
}

variable "alb_zone_id" {
  description = "ALB hosted zone ID — required for Route 53 alias records"
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g. staging, prod)"
  type        = string
}
