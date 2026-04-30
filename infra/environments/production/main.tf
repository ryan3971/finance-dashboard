# Production environment — not yet applied. Apply manually after purchasing domain
# and right-sizing ECS task count.
#
# IMPORTANT: Production and staging share the same hosted zone (ryantyrrell.ca) and
# currently the same subdomains (app.ryantyrrell.ca, api.ryantyrrell.ca). Before
# applying production, update staging to use different subdomains (e.g.
# staging.ryantyrrell.ca / api-staging.ryantyrrell.ca) so the Route 53 records do
# not conflict. See README.md for the full pre-apply checklist.

locals {
  # Both environments share the same ECR repository — only the image tag differs.
  ecr_repository_url = "187844640945.dkr.ecr.ca-central-1.amazonaws.com/finance-api"
}

terraform {
  backend "s3" {
    bucket         = "finance-tf-state-187844640945"
    key            = "environments/production/terraform.tfstate"
    region         = "ca-central-1"
    dynamodb_table = "terraform-state-lock"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ca-central-1"
}

# ACM certificates for CloudFront must be issued in us-east-1 regardless of
# where the rest of the infrastructure lives.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ── ACM — ca-central-1 (ALB HTTPS listener) ────────────────────────────────────
module "acm_ca_central_1" {
  source = "../../modules/acm"

  environment               = "production"
  domain_name               = "ryantyrrell.ca"
  subject_alternative_names = ["*.ryantyrrell.ca"]
  hosted_zone_id            = "Z012128821UVHFAOVK3KP"
}

# ── ACM — us-east-1 (CloudFront — must be in this region) ─────────────────────
module "acm_us_east_1" {
  source = "../../modules/acm"

  providers = {
    aws = aws.us_east_1
  }

  environment               = "production"
  domain_name               = "ryantyrrell.ca"
  subject_alternative_names = ["*.ryantyrrell.ca"]
  hosted_zone_id            = "Z012128821UVHFAOVK3KP"
}

# ── VPC ────────────────────────────────────────────────────────────────────────
module "vpc" {
  source = "../../modules/vpc"

  environment          = "production"
  vpc_cidr             = "10.1.0.0/16"
  public_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24"]
  private_subnet_cidrs = ["10.1.3.0/24", "10.1.4.0/24"]
}

# ── S3 ─────────────────────────────────────────────────────────────────────────
module "s3" {
  source = "../../modules/s3"

  environment          = "production"
  account_id           = "187844640945"
  frontend_bucket_name = "finance-frontend-prod-187844640945"
  uploads_bucket_name  = "finance-uploads-prod-187844640945"
}

# ── SSM ────────────────────────────────────────────────────────────────────────
# Production secrets are stored under a separate prefix to avoid colliding with
# staging parameters at /finance/*. After the first apply, populate each
# parameter via the AWS console or CLI — same pattern as staging. See README.md.
module "ssm" {
  source = "../../modules/ssm"

  environment      = "production"
  parameter_prefix = "/finance/production"
}

# ── ALB ────────────────────────────────────────────────────────────────────────
module "alb" {
  source = "../../modules/alb"

  environment       = "production"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  certificate_arn   = module.acm_ca_central_1.certificate_arn
}

# ── RDS ────────────────────────────────────────────────────────────────────────
module "rds" {
  source = "../../modules/rds"

  environment        = "production"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  # Initial placeholder — overwrite via CLI before the API connects:
  # aws rds modify-db-instance --db-instance-identifier production-finance-db \
  #   --master-user-password "<new-password>" --apply-immediately
  db_password = "PLACEHOLDER"
}

# ── ECS ────────────────────────────────────────────────────────────────────────
module "ecs" {
  source = "../../modules/ecs"

  environment           = "production"
  cors_origin           = "https://app.ryantyrrell.ca"
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  target_group_arn      = module.alb.target_group_arn
  alb_security_group_id = module.alb.alb_security_group_id
  rds_security_group_id = module.rds.rds_security_group_id
  ecr_repository_url    = local.ecr_repository_url
  image_tag             = "prod-latest"
  uploads_bucket_arn    = module.s3.uploads_bucket_arn
  ssm_db_url_arn             = module.ssm.db_url_arn
  ssm_jwt_secret_arn         = module.ssm.jwt_secret_arn
  ssm_jwt_refresh_secret_arn = module.ssm.jwt_refresh_secret_arn
  ssm_anthropic_key_arn      = module.ssm.anthropic_key_arn
  ssm_openai_key_arn         = module.ssm.openai_key_arn
  ssm_sentry_dsn_arn         = module.ssm.sentry_dsn_arn
  # TODO: right-size at launch based on observed staging utilization
  desired_count = 1
}

# ── CloudFront ─────────────────────────────────────────────────────────────────
module "cloudfront" {
  source = "../../modules/cloudfront"

  providers = {
    aws = aws.us_east_1
  }

  environment          = "production"
  frontend_bucket_name = module.s3.frontend_bucket_name
  frontend_bucket_arn  = module.s3.frontend_bucket_arn
  certificate_arn      = module.acm_us_east_1.certificate_arn
  domain_name          = "app.ryantyrrell.ca"
}

# ── S3 Bucket Policy ───────────────────────────────────────────────────────────
# Grants CloudFront OAC read access to the frontend bucket. The condition scopes
# the grant to this specific distribution — other CloudFront distributions cannot
# read from the bucket even if they use an OAC.
resource "aws_s3_bucket_policy" "frontend_oac" {
  bucket = module.s3.frontend_bucket_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${module.s3.frontend_bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = module.cloudfront.cloudfront_distribution_arn
          }
        }
      }
    ]
  })
}

# ── Route 53 ───────────────────────────────────────────────────────────────────
module "route53" {
  source = "../../modules/route53"

  environment               = "production"
  hosted_zone_id            = "Z012128821UVHFAOVK3KP"
  domain_name               = "ryantyrrell.ca"
  cloudfront_domain_name    = module.cloudfront.cloudfront_domain_name
  cloudfront_hosted_zone_id = module.cloudfront.cloudfront_hosted_zone_id
  alb_dns_name              = module.alb.alb_dns_name
  alb_zone_id               = module.alb.alb_zone_id
}
