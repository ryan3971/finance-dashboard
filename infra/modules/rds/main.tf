locals {
  common_tags = {
    Environment = var.environment
    Project     = "finance-dashboard"
  }
}

# ── DB Subnet Group ────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "this" {
  name       = "${var.environment}-finance-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(local.common_tags, {
    Name = "${var.environment}-finance-db-subnet-group"
  })
}

# ── Parameter Group ────────────────────────────────────────────────────────────

resource "aws_db_parameter_group" "this" {
  name   = "${var.environment}-finance-postgres15"
  family = "postgres15"

  tags = merge(local.common_tags, {
    Name = "${var.environment}-finance-postgres15"
  })
}

# ── Security Group ─────────────────────────────────────────────────────────────

resource "aws_security_group" "rds" {
  name        = "${var.environment}-rds-sg"
  description = "Allow inbound PostgreSQL from ECS tasks only"
  vpc_id      = var.vpc_id

  # Ingress rule added after ECS module creates its security group

  tags = merge(local.common_tags, {
    Name = "${var.environment}-rds-sg"
  })
}

# ── RDS Instance ───────────────────────────────────────────────────────────────

resource "aws_db_instance" "this" {
  identifier = "${var.environment}-finance-db"

  engine         = "postgres"
  engine_version = "15"
  instance_class = var.instance_class

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  parameter_group_name   = aws_db_parameter_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  publicly_accessible = false
  multi_az            = false

  backup_retention_period = 7
  deletion_protection     = true

  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.environment}-finance-final-snapshot"

  tags = merge(local.common_tags, {
    Name = "${var.environment}-finance-db"
  })

  # Ignore password after initial creation — update the master password via the
  # AWS console or CLI, then update /finance/db-url in SSM to match.
  lifecycle {
    ignore_changes = [password]
  }
}
