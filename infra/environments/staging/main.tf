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

module "rds" {
  source = "../../modules/rds"

  environment        = "staging"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  # Initial placeholder — overwrite via CLI before the API connects:
  # aws rds modify-db-instance --db-instance-identifier staging-finance-db \
  #   --master-user-password "<new-password>" --apply-immediately
  db_password           = "PLACEHOLDER"
}
