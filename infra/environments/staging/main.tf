locals {
  ecr_repository_url = "187844640945.dkr.ecr.ca-central-1.amazonaws.com/finance-api"
}

terraform {
  backend "s3" {
    bucket         = "finance-tf-state-187844640945"
    key            = "environments/staging/terraform.tfstate"
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

module "vpc" {
  source = "../../modules/vpc"

  environment = "staging"
}

module "s3" {
  source = "../../modules/s3"

  environment          = "staging"
  account_id           = "187844640945"
  frontend_bucket_name = "finance-frontend-187844640945"
  uploads_bucket_name  = "finance-uploads-187844640945"
}

module "ssm" {
  source = "../../modules/ssm"

  environment = "staging"
}

module "alb" {
  source = "../../modules/alb"

  environment       = "staging"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  certificate_arn   = ""
}

module "rds" {
  source = "../../modules/rds"

  environment        = "staging"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  # Initial placeholder — overwrite via CLI before the API connects:
  # aws rds modify-db-instance --db-instance-identifier staging-finance-db \
  #   --master-user-password "<new-password>" --apply-immediately
  db_password = "PLACEHOLDER"
}

module "ecs" {
  source = "../../modules/ecs"

  environment           = "staging"
  cors_origin           = "https://${module.alb.alb_dns_name}"
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  target_group_arn      = module.alb.target_group_arn
  alb_security_group_id = module.alb.alb_security_group_id
  rds_security_group_id = module.rds.rds_security_group_id
  ecr_repository_url    = local.ecr_repository_url
  uploads_bucket_arn    = module.s3.uploads_bucket_arn
  ssm_db_url_arn        = module.ssm.db_url_arn
  ssm_jwt_secret_arn         = module.ssm.jwt_secret_arn
  ssm_jwt_refresh_secret_arn = module.ssm.jwt_refresh_secret_arn
  ssm_anthropic_key_arn = module.ssm.anthropic_key_arn
  ssm_openai_key_arn    = module.ssm.openai_key_arn
  ssm_sentry_dsn_arn    = module.ssm.sentry_dsn_arn
}
