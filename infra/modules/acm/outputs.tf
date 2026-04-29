output "certificate_arn" {
  description = "ARN of the validated ACM certificate"
  # Reference the validation resource, not the certificate directly.
  # This creates an implicit dependency so any consumer of this output
  # also waits for validation to complete before proceeding.
  value = aws_acm_certificate_validation.this.certificate_arn
}
