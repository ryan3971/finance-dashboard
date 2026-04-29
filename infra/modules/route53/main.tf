locals {
  common_tags = {
    Environment = var.environment
    Project     = "finance-dashboard"
  }
}

# ── Frontend — app.ryantyrrell.ca → CloudFront ─────────────────────────────────

resource "aws_route53_record" "app" {
  zone_id = var.hosted_zone_id
  name    = "app.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

# ── API — api.ryantyrrell.ca → ALB ────────────────────────────────────────────

resource "aws_route53_record" "api" {
  zone_id = var.hosted_zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}
