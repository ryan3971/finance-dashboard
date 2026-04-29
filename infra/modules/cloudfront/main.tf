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

  # AWS managed CachingOptimized policy — caches based on query strings and
  # headers that matter for static assets. Do not substitute a custom policy.
  caching_optimized_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
}

# ── Origin Access Control ──────────────────────────────────────────────────────
# OAC is the modern replacement for OAI. It signs requests to S3 with SigV4 so
# the bucket can verify they originated from this specific distribution.

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.environment}-finance-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── CloudFront Distribution ────────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [var.domain_name]
  price_class         = "PriceClass_100"

  origin {
    domain_name              = "${var.frontend_bucket_name}.s3.amazonaws.com"
    origin_id                = "s3-${var.frontend_bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-${var.frontend_bucket_name}"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = local.caching_optimized_policy_id
  }

  # SPA fallback — TanStack Router handles all routes client-side. Without these
  # rules, any direct navigation to a deep link (e.g. /transactions/123) would
  # return a 403 (S3 access denied for missing key) instead of serving index.html.
  # TTL 0 ensures stale error responses are never cached.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(local.common_tags, {
    Name = "${var.environment}-finance-distribution"
  })
}
