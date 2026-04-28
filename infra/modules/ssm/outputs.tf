output "db_url_arn" {
  description = "ARN of the /finance/db-url SSM parameter"
  value       = aws_ssm_parameter.db_url.arn
}

output "jwt_secret_arn" {
  description = "ARN of the /finance/jwt-secret SSM parameter"
  value       = aws_ssm_parameter.jwt_secret.arn
}

output "jwt_refresh_secret_arn" {
  value = aws_ssm_parameter.jwt_refresh_secret.arn
}

output "anthropic_key_arn" {
  description = "ARN of the /finance/anthropic-key SSM parameter"
  value       = aws_ssm_parameter.anthropic_key.arn
}

output "openai_key_arn" {
  description = "ARN of the /finance/openai-key SSM parameter"
  value       = aws_ssm_parameter.openai_key.arn
}

output "sentry_dsn_arn" {
  description = "ARN of the /finance/sentry-dsn-backend SSM parameter"
  value       = aws_ssm_parameter.sentry_dsn.arn
}
