data "aws_region" "current" {}

locals {
  common_tags = {
    Environment = var.environment
    Project     = "finance-dashboard"
  }
}

# ── ECS Security Group ─────────────────────────────────────────────────────────

resource "aws_security_group" "ecs" {
  name        = "${var.environment}-ecs-sg"
  description = "ECS task security group - inbound from ALB, outbound to RDS and internet"
  vpc_id      = var.vpc_id

  ingress {
    description     = "App port from ALB"
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  egress {
    description     = "PostgreSQL to RDS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.rds_security_group_id]
  }

  egress {
    description = "HTTPS to internet (ECR, SSM, CloudWatch)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.environment}-ecs-sg"
  })
}

# ── Cross-module Security Group Rules ─────────────────────────────────────────
# Defined here (in the module that owns the ECS SG) to avoid circular
# dependencies between the ALB and RDS modules.

resource "aws_security_group_rule" "alb_to_ecs_egress" {
  description              = "ALB egress to ECS tasks on app port"
  type                     = "egress"
  security_group_id        = var.alb_security_group_id
  source_security_group_id = aws_security_group.ecs.id
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ecs_to_rds_ingress" {
  description              = "ECS tasks ingress to RDS on port 5432"
  type                     = "ingress"
  security_group_id        = var.rds_security_group_id
  source_security_group_id = aws_security_group.ecs.id
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
}

# ── CloudWatch Log Group ───────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.environment}-finance-api"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "/ecs/${var.environment}-finance-api"
  })
}

# ── IAM — Task Execution Role ──────────────────────────────────────────────────
# Used by the ECS agent to pull images from ECR, fetch SSM secrets, and write
# logs to CloudWatch. Not available to application code inside the container.

resource "aws_iam_role" "task_execution" {
  name = "${var.environment}-finance-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "task_execution_inline" {
  name = "${var.environment}-finance-task-execution-inline"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SSMSecrets"
        Effect = "Allow"
        Action = ["ssm:GetParameters"]
        Resource = [
          var.ssm_db_url_arn,
          var.ssm_jwt_secret_arn,
          var.ssm_jwt_refresh_secret_arn,
          var.ssm_anthropic_key_arn,
          var.ssm_openai_key_arn,
          var.ssm_sentry_dsn_arn,
        ]
      },
      {
        Sid      = "ECRAuth"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = ["*"]
      }
    ]
  })
}

# ── IAM — Task Role ────────────────────────────────────────────────────────────
# Assumed by application code running inside the container. Scoped to only the
# S3 operations needed for presigned URL uploads and file management.
# Note: presigned URL generation is a client-side SDK operation — no IAM action
# is required for generation itself. The permissions below cover the underlying
# S3 operations that execute when a presigned URL is used.

resource "aws_iam_role" "task" {
  name = "${var.environment}-finance-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "task_inline" {
  name = "${var.environment}-finance-task-inline"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "UploadsReadWrite"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
        ]
        Resource = "${var.uploads_bucket_arn}/*"
      },
      {
        Sid    = "ECSExec"
        Effect = "Allow"
        Action = [
          "ssm:StartSession",
          "ssm:TerminateSession",
          "ssm:ResumeSession",
          "ssm:DescribeSessions",
          "ssm:GetConnectionStatus",
        ]
        Resource = "*"
      }
    ]
  })
}

# ── ECS Cluster ────────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "this" {
  name = "${var.environment}-finance"

  tags = merge(local.common_tags, {
    Name = "${var.environment}-finance"
  })
}

# ── ECS Task Definition ────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "this" {
  family                   = "${var.environment}-finance-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name  = "finance-api"
      image = "${var.ecr_repository_url}:staging-latest"

      portMappings = [
        {
          containerPort = var.app_port
          protocol      = "tcp"
        }
      ]

      secrets = [
        { name = "DATABASE_URL",       valueFrom = var.ssm_db_url_arn },
        { name = "JWT_SECRET",         valueFrom = var.ssm_jwt_secret_arn },
        { name = "JWT_REFRESH_SECRET", valueFrom = var.ssm_jwt_refresh_secret_arn },
        { name = "ANTHROPIC_API_KEY",  valueFrom = var.ssm_anthropic_key_arn },
        { name = "OPENAI_API_KEY",     valueFrom = var.ssm_openai_key_arn },
        { name = "SENTRY_DSN",         valueFrom = var.ssm_sentry_dsn_arn },
      ]

      environment = [
        { name = "NODE_ENV",     value = var.node_env },
        { name = "PORT",         value = tostring(var.app_port) },
        { name = "CORS_ORIGIN",  value = var.cors_origin },
        { name = "LOG_LEVEL", value = var.log_level }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = merge(local.common_tags, {
    Name = "${var.environment}-finance-api"
  })
}

# ── ECS Service ────────────────────────────────────────────────────────────────

resource "aws_ecs_service" "this" {
  name            = "${var.environment}-finance-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  enable_execute_command = true

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "finance-api"
    container_port   = var.app_port
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
  force_new_deployment               = false

  tags = merge(local.common_tags, {
    Name = "${var.environment}-finance-api"
  })
}
