locals {
  common_tags = {
    Environment = var.environment
    Project     = "finance-dashboard"
  }
}

# ── Security Group ─────────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${var.environment}-alb-sg"
  description = "Allow inbound HTTP and HTTPS from the internet"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.environment}-alb-sg"
  })
}

# ── Load Balancer ──────────────────────────────────────────────────────────────

resource "aws_lb" "this" {
  name               = "${var.environment}-finance-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = false

  tags = merge(local.common_tags, {
    Name = "${var.environment}-finance-alb"
  })
}

# ── Target Group ───────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "this" {
  name        = "${var.environment}-finance-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  deregistration_delay = 30

  health_check {
    path                = "/api/v1/health"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = merge(local.common_tags, {
    Name = "${var.environment}-finance-tg"
  })
}

# ── Listeners ──────────────────────────────────────────────────────────────────
# temporary change
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
  
  tags = {
    Environment = var.environment
    Project     = "finance-dashboard"
  }
}

# Only created once a certificate ARN is supplied
resource "aws_lb_listener" "https" {
  count = var.certificate_arn != "" ? 1 : 0

  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}
