output "app_domain" {
  description = "Fully qualified domain name for the frontend (app.ryantyrrell.ca)"
  value       = aws_route53_record.app.fqdn
}

output "api_domain" {
  description = "Fully qualified domain name for the API (api.ryantyrrell.ca)"
  value       = aws_route53_record.api.fqdn
}
