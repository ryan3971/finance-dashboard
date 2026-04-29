output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution — used in the S3 bucket policy OAC condition"
  value       = aws_cloudfront_distribution.this.arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution — used for cache invalidation in GitHub Actions"
  value       = aws_cloudfront_distribution.this.id
}

output "cloudfront_domain_name" {
  description = "CloudFront-assigned domain name — used as the Route 53 alias target"
  value       = aws_cloudfront_distribution.this.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront hosted zone ID — required for Route 53 alias records"
  value       = aws_cloudfront_distribution.this.hosted_zone_id
}
