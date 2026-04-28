locals {
  common_tags = {
    Environment = var.environment
    Project     = "finance-dashboard"
  }
}

# IMPORTANT: All parameter values are initialised to "PLACEHOLDER".
# After running `terraform apply`, update each value manually via the AWS
# console or CLI — for example:
#
#   aws ssm put-parameter \
#     --name "/finance/db-url" \
#     --value "postgres://..." \
#     --type SecureString \
#     --overwrite
#
# The lifecycle { ignore_changes = [value] } block on every resource ensures
# that subsequent `terraform apply` runs never overwrite values that have been
# set this way, so secrets survive infrastructure updates.

resource "aws_ssm_parameter" "db_url" {
  name  = "${var.parameter_prefix}/db-url"
  type  = "SecureString"
  tier  = "Standard"
  value = "PLACEHOLDER"

  tags = merge(local.common_tags, {
    Name = "${var.parameter_prefix}/db-url"
  })

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "${var.parameter_prefix}/jwt-secret"
  type  = "SecureString"
  tier  = "Standard"
  value = "PLACEHOLDER"

  tags = merge(local.common_tags, {
    Name = "${var.parameter_prefix}/jwt-secret"
  })

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "jwt_refresh_secret" {
  name  = "${var.parameter_prefix}/jwt-refresh-secret"
  type  = "SecureString"
  value = "PLACEHOLDER"
  tier  = "Standard"

  tags = {
    Environment = var.environment
    Name        = "${var.parameter_prefix}/jwt-refresh-secret"
    Project     = "finance-dashboard"
  }

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "anthropic_key" {
  name  = "${var.parameter_prefix}/anthropic-key"
  type  = "SecureString"
  tier  = "Standard"
  value = "PLACEHOLDER"

  tags = merge(local.common_tags, {
    Name = "${var.parameter_prefix}/anthropic-key"
  })

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "openai_key" {
  name  = "${var.parameter_prefix}/openai-key"
  type  = "SecureString"
  tier  = "Standard"
  value = "PLACEHOLDER"

  tags = merge(local.common_tags, {
    Name = "${var.parameter_prefix}/openai-key"
  })

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "sentry_dsn" {
  name  = "${var.parameter_prefix}/sentry-dsn-backend"
  type  = "SecureString"
  tier  = "Standard"
  value = "PLACEHOLDER"

  tags = merge(local.common_tags, {
    Name = "${var.parameter_prefix}/sentry-dsn-backend"
  })

  lifecycle {
    ignore_changes = [value]
  }
}
