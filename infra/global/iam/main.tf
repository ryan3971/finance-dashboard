terraform {
  backend "s3" {
    bucket         = "finance-tf-state-187844640945"
    key            = "global/iam/terraform.tfstate"
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

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "github_actions_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:ryan3971/finance-dashboard:*"]
    }
  }
}

resource "aws_iam_role" "github_actions_finance" {
  name               = "github-actions-finance"
  assume_role_policy = data.aws_iam_policy_document.github_actions_trust.json
}

data "aws_iam_policy_document" "github_actions_permissions" {
  statement {
    sid    = "ECRAuth"
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ECRPush"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart"
    ]
    resources = ["arn:aws:ecr:ca-central-1:${data.aws_caller_identity.current.account_id}:repository/finance-api"]
  }

  statement {
    sid    = "S3Sync"
    effect = "Allow"
    actions = [
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:PutObject"
    ]
    resources = [
      "arn:aws:s3:::finance-frontend-${data.aws_caller_identity.current.account_id}",
      "arn:aws:s3:::finance-frontend-${data.aws_caller_identity.current.account_id}/*",
      "arn:aws:s3:::finance-uploads-${data.aws_caller_identity.current.account_id}",
      "arn:aws:s3:::finance-uploads-${data.aws_caller_identity.current.account_id}/*"
    ]
  }

  statement {
    sid    = "ECS"
    effect = "Allow"
    actions = [
      "ecs:DescribeServices",
      "ecs:UpdateService"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "SSM"
    effect = "Allow"
    actions = [
      "ssm:GetParameters"
    ]
    resources = [
      "arn:aws:ssm:ca-central-1:${data.aws_caller_identity.current.account_id}:parameter/finance/*"
    ]
  }
}

resource "aws_iam_role_policy" "github_actions_finance" {
  name   = "github-actions-finance-policy"
  role   = aws_iam_role.github_actions_finance.id
  policy = data.aws_iam_policy_document.github_actions_permissions.json
}
