terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

locals {
  common_tags = {
    Environment = var.environment
    Project     = "finance-dashboard"
  }
}

# ── Certificate ────────────────────────────────────────────────────────────────
# create_before_destroy ensures a replacement certificate is fully validated
# before the old one is destroyed, preventing downtime during renewals.

resource "aws_acm_certificate" "this" {
  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"

  tags = merge(local.common_tags, {
    Name = "${var.environment}-${var.domain_name}"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# ── DNS Validation Records ─────────────────────────────────────────────────────
# ACM emits one validation record per unique domain in the certificate.
# for_each over domain_validation_options de-duplicates them (a wildcard and its
# apex share the same CNAME) and creates exactly the records ACM requires.

resource "aws_route53_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = var.hosted_zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60

  allow_overwrite = true
}

# ── Certificate Validation ─────────────────────────────────────────────────────
# Blocks until ACM confirms the certificate is ISSUED. Downstream resources
# (ALB HTTPS listener, CloudFront distribution) depend on this resource, so
# Terraform will not proceed to create them until validation succeeds.

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.validation : r.fqdn]
}
