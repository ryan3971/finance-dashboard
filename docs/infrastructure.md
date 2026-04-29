# Infrastructure

This document covers all infrastructure files — Terraform (IaC), GitHub Actions (CI/CD), Docker, and helper scripts. It is aimed at developers who need to understand, operate, or modify the deployment stack.

---

## Table of Contents

- [Directory Overview](#directory-overview)
- [Architecture Summary](#architecture-summary)
- [Docker & Local Dev](#docker--local-dev)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Terraform](#terraform)
  - [State Management](#state-management)
  - [Global Stack](#global-stack)
  - [Staging Environment Stack](#staging-environment-stack)
  - [Modules](#modules)
- [Secrets & SSM Parameters](#secrets--ssm-parameters)
- [DNS & Domains](#dns--domains)
- [Deployment Runbook](#deployment-runbook)

---

## Directory Overview

```
.
├── .github/
│   └── workflows/
│       ├── validate.yml          # CI: typecheck, lint, test
│       ├── deploy-api.yml        # CD: build → push ECR → migrate → deploy ECS
│       └── deploy-frontend.yml   # CD: build → sync S3 → invalidate CloudFront
├── apps/
│   └── api/
│       └── Dockerfile            # Multi-stage API image build
├── infra/
│   ├── environments/
│   │   └── staging/
│   │       └── main.tf           # Root module for the staging environment
│   ├── global/
│   │   ├── ecr/                  # ECR repository (shared across environments)
│   │   └── iam/                  # GitHub Actions OIDC role (shared)
│   └── modules/
│       ├── acm/                  # ACM certificate + Route53 validation
│       ├── alb/                  # Application Load Balancer
│       ├── cloudfront/           # CloudFront distribution + OAC
│       ├── ecs/                  # ECS cluster, task definition, service, IAM
│       ├── rds/                  # RDS PostgreSQL instance
│       ├── route53/              # DNS alias records
│       ├── s3/                   # Frontend and uploads S3 buckets
│       ├── ssm/                  # SSM SecureString parameters
│       └── vpc/                  # VPC, subnets, NAT gateways
├── scripts/
│   └── docker/
│       └── init-multiple-dbs.sh  # PostgreSQL init script for local dev
├── docker-compose.yml            # Local dev: PostgreSQL + API
└── .dockerignore
```

---

## Architecture Summary

```
Internet
   │
   ├─ app.ryantyrrell.ca  ──→  CloudFront (PriceClass_100)  ──→  S3 (frontend bucket, private, OAC)
   │
   └─ api.ryantyrrell.ca  ──→  ALB (HTTPS 443, HTTP 80)  ──→  ECS Fargate (private subnet)
                                                                    │
                                                                    └─→  RDS PostgreSQL 15 (private subnet)
```

**Key properties:**

- All compute (ECS tasks) and the database (RDS) live in private subnets behind NAT gateways.
- The ALB is the only public entry point to the API.
- CloudFront + OAC is the only entity with read access to the S3 frontend bucket — public access is blocked.
- Secrets never appear in source code or environment definitions; they are stored in SSM Parameter Store (SecureString) and injected at container startup.
- GitHub Actions authenticates to AWS via OIDC federation — no long-lived AWS access keys.

---

## Docker & Local Dev

### `docker-compose.yml`

Runs PostgreSQL 15 and the API locally.

| Service | Port | Notes |
|---------|------|-------|
| `postgres` | 5434 (host) → 5432 | Alpine image; runs `init-multiple-dbs.sh` on first start |
| `api` | 3000 | Waits for postgres health check before starting |

The compose file mounts `scripts/docker/init-multiple-dbs.sh` into the Postgres container's `docker-entrypoint-initdb.d/` directory so it runs automatically on first database initialisation.

**Environment variables the postgres service expects:**

| Variable | Example | Purpose |
|----------|---------|---------|
| `POSTGRES_DB` | `finance_dev` | Primary database |
| `POSTGRES_USER` | `postgres` | Superuser |
| `POSTGRES_PASSWORD` | — | Superuser password |
| `POSTGRES_MULTIPLE_DATABASES` | `finance_test` | Additional DBs created by the init script |

### `scripts/docker/init-multiple-dbs.sh`

Creates one additional database per entry in `POSTGRES_MULTIPLE_DATABASES` (comma-separated). Runs only on the very first container start (Postgres `initdb.d` semantics). If you need to re-run it against an existing volume, tear down the volume first:

```bash
docker compose down -v
docker compose up
```

### `apps/api/Dockerfile`

Multi-stage build optimised for a small production image.

| Stage | Base | Purpose |
|-------|------|---------|
| `base` | `node:20-alpine` | Sets up pnpm and working directory |
| `deps` | `base` | Installs all dependencies (dev + prod) using pnpm content-addressable store |
| `build` | `deps` | Compiles TypeScript for api and shared packages |
| `runner` | `base` | Copies only compiled output + production deps; runs `node dist/server.js` |

The `runner` stage re-uses the pnpm store from the `deps` stage with `--prefer-offline` so no network access is needed at image runtime.

**What gets copied into `runner`:**

- `packages/shared/dist` — compiled shared types/schemas
- `apps/api/dist` — compiled API
- `apps/api/drizzle/` — migration SQL files
- `apps/api/drizzle.config.ts` — required by `drizzle-kit migrate`
- Production `node_modules` (via pnpm store)

The image exposes port 3000. The ECS task definition maps this to the ALB target group.

### `.dockerignore`

Excludes from the build context: `node_modules`, `dist`, `.git`, `apps/api/.env*`. Keep this file updated when adding new build artefacts that should not be sent to the Docker daemon.

---

## GitHub Actions Workflows

All three workflows use OIDC to assume the `github-actions` IAM role — no AWS credentials are stored as secrets. The role ARN is stored in the `AWS_ROLE_ARN` repository secret.

### `validate.yml` — CI

**Triggers:** Push to `main`, PR against `main`.

**What it does:**

1. Spins up a PostgreSQL 15 service container (port 5432).
2. Sets `DATABASE_URL`, `DATABASE_URL_TEST`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
3. Installs dependencies with frozen lockfile.
4. Runs `pnpm typecheck` and `pnpm lint` for both `api` and `web`.
5. Runs database migrations (`pnpm db:migrate`).
6. Runs the full API test suite.

The deploy workflows only trigger after this workflow completes successfully on `main`.

### `deploy-api.yml` — API CD

**Triggers:** `validate.yml` completes successfully on `main`.

**Concurrency:** Serialised per branch (`cancel-in-progress: false`) — a queued deploy is never dropped.

**Steps in detail:**

1. Assume AWS role via OIDC.
2. Authenticate Docker to ECR.
3. Build the API image from `apps/api/Dockerfile` with two tags:
   - `staging-<git-sha>` — immutable, used for rollback.
   - `staging-latest` — mutable, pulled by the ECS task definition.
4. Push both tags to ECR.
5. Run a one-off Fargate task that executes `drizzle-kit migrate` against the production database (using the `DATABASE_URL` SSM parameter). The workflow polls until the task exits and fails the pipeline if the migration exits non-zero.
6. Call `ecs update-service --force-new-deployment` to trigger a rolling replacement.
7. Wait for the service to stabilise (`ecs wait services-stable`).

**AWS secrets required:**

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | ARN of the `github-actions` IAM role |
| `ECR_REPOSITORY_URL` | Full ECR URL (without tag) |

**Other values referenced** (hardcoded in the workflow or passed as env):

| Variable | Value |
|----------|-------|
| `AWS_REGION` | `ca-central-1` |
| ECS cluster name | `staging-finance` |
| ECS service name | set in workflow env |
| Migration task definition | set in workflow env |

### `deploy-frontend.yml` — Frontend CD

**Triggers:** `validate.yml` completes successfully on `main`.

**Steps in detail:**

1. Assume AWS role via OIDC.
2. Install dependencies.
3. Run `vite build` with `VITE_API_URL` and `VITE_SENTRY_DSN` injected from repository secrets/variables.
4. Sync `apps/web/dist` to the S3 frontend bucket using `aws s3 sync --delete` (removes stale files).
5. Invalidate the CloudFront distribution with path `/*` so CDN edge caches are flushed immediately.

**AWS secrets required:**

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | ARN of the `github-actions` IAM role |
| `VITE_API_URL` | Public API base URL (`https://api.ryantyrrell.ca`) |
| `VITE_SENTRY_DSN` | Sentry DSN for the frontend project |

---

## Terraform

The Terraform configuration is split into three independent stacks (each with its own state file):

| Stack | Path | Apply frequency |
|-------|------|-----------------|
| Global — ECR | `infra/global/ecr/` | Once (rarely changes) |
| Global — IAM | `infra/global/iam/` | Once (rarely changes) |
| Staging environment | `infra/environments/staging/` | On infra changes |

### State Management

| Resource | Value |
|----------|-------|
| S3 state bucket | `finance-tf-state-187844640945` |
| DynamoDB lock table | `terraform-state-lock` |
| Region | `ca-central-1` |

State keys:

- `global/ecr/terraform.tfstate`
- `global/iam/terraform.tfstate`
- `environments/staging/terraform.tfstate`

Each stack has a `.terraform.lock.hcl` file — commit any changes to it so provider versions stay pinned across contributors.

**Working with state:**

```bash
cd infra/environments/staging
terraform init    # downloads providers, connects to S3 backend
terraform plan
terraform apply
```

Never manually edit or delete the state file. Use `terraform state mv` / `terraform state rm` for surgical changes.

### Global Stack

#### `infra/global/ecr/`

Creates the ECR repository `finance-api`.

Notable configuration:

- **Image scanning on push** — enabled. Check scan findings in the AWS console after each push.
- **Lifecycle policy:**
  - Untagged images expire after 1 day.
  - Tagged images matching `staging-*` or `prod-*` are kept for a maximum of 10 images each. When you exceed 10 images for a prefix the oldest is automatically expired.

Output: `repository_url` — referenced by the staging environment stack and the deploy workflow.

#### `infra/global/iam/`

Creates the OIDC provider and the `github-actions` IAM role used by all three GitHub Actions workflows.

The role's trust policy restricts assumption to the repository `ryan3971/finance-dashboard` — update `main.tf` here if the GitHub org or repo name changes.

**Allowed actions the role can perform:**

| Service | Actions |
|---------|---------|
| ECR | Auth, push layers and images |
| S3 | List, get, put, delete on the frontend and uploads buckets |
| ECS | DescribeServices, DescribeTasks, RunTask, UpdateService |
| IAM | PassRole to ECS task execution and task roles |
| SSM | GetParameters, GetParameter on `/finance/*` |
| CloudFront | CreateInvalidation |

Output: `github_actions_role_arn` — copy this into the `AWS_ROLE_ARN` repository secret.

---

### Staging Environment Stack

`infra/environments/staging/main.tf` composes all modules for the staging environment. Most values (bucket names, hosted zone ID, domain) are hardcoded in this file.

**AWS providers:**

| Alias | Region | Used for |
|-------|--------|---------|
| (default) | `ca-central-1` | Everything except CloudFront cert |
| `us_east_1` | `us-east-1` | ACM cert for CloudFront (CloudFront requires us-east-1) |

The backend block at the top of `main.tf` configures S3 remote state. Run `terraform init` after any change to the backend block.

---

### Modules

#### `acm`

Creates an ACM certificate and validates it automatically via Route53 DNS.

**Variables:**

| Variable | Description |
|----------|-------------|
| `domain_name` | Primary domain (e.g. `ryantyrrell.ca`) |
| `subject_alternative_names` | Additional SANs (e.g. `["*.ryantyrrell.ca"]`) |
| `hosted_zone_id` | Route53 hosted zone for DNS validation |
| `environment` | Tag value |

Certificate validation uses `lifecycle { create_before_destroy = true }` to allow zero-downtime renewals.

**Output:** `certificate_arn` — passed to the ALB and CloudFront modules.

---

#### `vpc`

Creates a VPC with two public and two private subnets across two availability zones, plus NAT gateways for private subnet egress.

**CIDR allocation (defaults):**

| Subnet | CIDR |
|--------|------|
| VPC | `10.0.0.0/16` |
| Public AZ-a | `10.0.1.0/24` |
| Public AZ-b | `10.0.2.0/24` |
| Private AZ-a | `10.0.3.0/24` |
| Private AZ-b | `10.0.4.0/24` |

ECS tasks and RDS run in private subnets. The ALB runs in public subnets. NAT gateways (one per AZ) allow private resources to reach ECR, SSM, and CloudWatch without exposing them to inbound internet traffic.

**Outputs:** `vpc_id`, `public_subnet_ids`, `private_subnet_ids`, `vpc_cidr`.

---

#### `alb`

Creates an internet-facing Application Load Balancer.

**Security group rules:**

- Inbound: HTTP 80 and HTTPS 443 from `0.0.0.0/0`.
- Outbound: set by the ECS module to allow traffic to ECS tasks on port 3000 (cross-module rule to avoid circular dependencies).

**Target group:**

- Port: 3000, protocol: HTTP, target type: `ip` (required for Fargate).
- Health check: `GET /api/v1/health`, healthy threshold 2, unhealthy threshold 3.
- Deregistration delay: 30 seconds.

**Listeners:**

- Port 80: currently serves traffic directly (HTTP). The `main.tf` comment notes this is a temporary configuration.
- Port 443: HTTPS with ACM certificate (only created when `certificate_arn` is provided).

**Outputs:** `alb_arn`, `alb_dns_name`, `alb_zone_id`, `target_group_arn`, `alb_security_group_id`.

---

#### `rds`

Creates a PostgreSQL 15 RDS instance in private subnets.

**Configuration:**

| Setting | Value |
|---------|-------|
| Engine | PostgreSQL 15 |
| Instance class | `db.t3.micro` (variable) |
| Storage | 20 GiB initial, up to 100 GiB with autoscaling |
| Encryption | Enabled at rest |
| Backups | 7-day retention |
| Deletion protection | Enabled |
| Multi-AZ | Disabled |
| Public access | Disabled |

The initial `password` is set by the `db_password` variable and has `ignore_changes = [password]` in the lifecycle block — Terraform will not overwrite the password after initial creation. Rotate passwords directly via the AWS console or CLI.

**Security group:** Allows inbound PostgreSQL (5432) from the ECS security group only. The ingress rule is defined in the ECS module to avoid a circular dependency.

**Outputs:** `db_endpoint`, `db_port`, `db_name`, `db_username`, `rds_security_group_id`.

---

#### `ecs`

The most complex module — creates the full ECS cluster, task definition, service, and supporting IAM roles.

**Security group:**

- Inbound: port 3000 from the ALB security group only.
- Outbound: port 5432 to the RDS security group, port 443 to internet (for ECR image pulls, SSM, CloudWatch Logs).

**Task definition:**

| Setting | Value |
|---------|-------|
| Launch type | Fargate |
| CPU | 256 (0.25 vCPU) |
| Memory | 512 MiB |
| Image | `<ecr_url>:staging-latest` |
| Container port | 3000 |

**Secrets (injected from SSM at task start):**

| Container env var | SSM parameter |
|-------------------|--------------|
| `DATABASE_URL` | `/finance/db-url` |
| `JWT_SECRET` | `/finance/jwt-secret` |
| `JWT_REFRESH_SECRET` | `/finance/jwt-refresh-secret` |
| `ANTHROPIC_API_KEY` | `/finance/anthropic-key` |
| `OPENAI_API_KEY` | `/finance/openai-key` |
| `SENTRY_DSN` | `/finance/sentry-dsn-backend` |

**Static environment variables** (not secrets):

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `CORS_ORIGIN` | set by variable |
| `LOG_LEVEL` | `info` |

**IAM roles:**

- **Task execution role** — used by the ECS agent to pull the image and read SSM secrets. Has `AmazonECSTaskExecutionRolePolicy` plus inline SSM access.
- **Task role** — used by the running application container. Has inline S3 permissions (PutObject, GetObject, DeleteObject) on the uploads bucket for presigned URL flows.

**ECS service:**

- Desired count: 1.
- Deployment: 50% min healthy, 200% max — allows a second task to start before the old one stops (rolling update).
- `force_new_deployment` is set to `false` in Terraform; the deploy workflow triggers new deployments via `aws ecs update-service --force-new-deployment`.

**Outputs:** `ecs_security_group_id`, `ecs_cluster_name`, `ecs_service_name`, `task_execution_role_arn`, `task_role_arn`.

---

#### `s3`

Creates two S3 buckets, both with public access blocked.

| Bucket | Versioning | Purpose |
|--------|-----------|---------|
| `finance-frontend-<account-id>` | Enabled | SPA static assets served via CloudFront |
| `finance-uploads-<account-id>` | Disabled | User-uploaded files accessed via presigned URLs |

**Uploads bucket extras:**

- CORS policy allows `PUT` and `POST` from any origin — required for browser-direct presigned URL uploads.
- Lifecycle policy: objects expire after 1 day (intended for temporary uploads; adjust if you add permanent storage).

---

#### `ssm`

Creates six `SecureString` SSM parameters under the `/finance/` path. All are initialised with a `PLACEHOLDER` value and have `ignore_changes = [value]` — Terraform will never overwrite values after the first apply.

**Set values after initial apply:**

```bash
aws ssm put-parameter \
  --name "/finance/db-url" \
  --value "postgres://user:pass@host:5432/db?sslmode=require" \
  --type SecureString \
  --overwrite \
  --region ca-central-1
```

Repeat for each parameter. Do not hardcode values in Terraform variables or `.tfvars` files.

**Parameters:**

| SSM Path | Used for |
|----------|---------|
| `/finance/db-url` | `DATABASE_URL` in the API container |
| `/finance/jwt-secret` | JWT access token signing |
| `/finance/jwt-refresh-secret` | JWT refresh token signing |
| `/finance/anthropic-key` | Anthropic API (AI categorisation) |
| `/finance/openai-key` | OpenAI API (AI categorisation) |
| `/finance/sentry-dsn-backend` | Sentry error tracking for the API |

---

#### `cloudfront`

Creates a CloudFront distribution that serves the frontend S3 bucket.

**Key settings:**

| Setting | Value |
|---------|-------|
| Price class | `PriceClass_100` (North America + Europe edge nodes only) |
| Default root object | `index.html` |
| HTTP → HTTPS | Redirect |
| TLS minimum | TLSv1.2 |
| Cache policy | `CachingOptimized` (AWS managed) |
| IPv6 | Enabled |

**SPA routing:** 403 and 404 responses from S3 are intercepted and returned as 200 with `/index.html` (TTL 0). This allows the React Router to handle client-side routes without CloudFront returning an error.

**Origin Access Control (OAC):** Uses SigV4 signing — the S3 bucket policy (defined in the staging `main.tf`) allows reads only from this CloudFront distribution's service principal. No pre-signed URLs or public bucket access are used.

**Outputs:** `cloudfront_distribution_id` (used in the deploy workflow for cache invalidation), `cloudfront_domain_name`, `cloudfront_hosted_zone_id`.

---

#### `route53`

Creates two alias records in the `ryantyrrell.ca` hosted zone:

| Record | Target |
|--------|--------|
| `app.ryantyrrell.ca` | CloudFront distribution |
| `api.ryantyrrell.ca` | ALB (`evaluate_target_health: true`) |

The hosted zone ID is `Z012128821UVHFAOVK3KP`. To add additional subdomains, extend this module or add `aws_route53_record` resources directly in the staging `main.tf`.

---

## Secrets & SSM Parameters

All runtime secrets are stored in AWS SSM Parameter Store as `SecureString` (AES-256 encrypted with the default AWS-managed KMS key). They are never checked into source code or passed through environment variable injection in the task definition plaintext fields.

**To update a secret:**

```bash
aws ssm put-parameter \
  --name "/finance/<parameter-name>" \
  --value "<new-value>" \
  --type SecureString \
  --overwrite \
  --region ca-central-1
```

After updating a secret, trigger a new ECS deployment so running tasks pick up the new value:

```bash
aws ecs update-service \
  --cluster staging-finance \
  --service <service-name> \
  --force-new-deployment \
  --region ca-central-1
```

---

## DNS & Domains

| Domain | Record type | Target |
|--------|-------------|--------|
| `app.ryantyrrell.ca` | A (alias) | CloudFront distribution |
| `api.ryantyrrell.ca` | A (alias) | ALB |

**Certificates:**

- ALB HTTPS — ACM cert issued in `ca-central-1` (covers `ryantyrrell.ca` and `*.ryantyrrell.ca`).
- CloudFront — ACM cert issued in `us-east-1` (CloudFront requirement).

Both certs are validated via Route53 DNS CNAME records created automatically by the `acm` module.

---

## Deployment Runbook

### Normal code deployment (automated)

Push to `main`. GitHub Actions runs `validate.yml`, then (on success) triggers `deploy-api.yml` and `deploy-frontend.yml` in parallel.

### Manual API deployment

```bash
# Trigger a force-new-deployment without a code change
aws ecs update-service \
  --cluster staging-finance \
  --service <service-name> \
  --force-new-deployment \
  --region ca-central-1
```

### Run a database migration manually

```bash
# Run the migration Fargate task (same task definition the deploy workflow uses)
aws ecs run-task \
  --cluster staging-finance \
  --task-definition <migration-task-def-name> \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<private-subnet-id>],securityGroups=[<ecs-sg-id>],assignPublicIp=DISABLED}" \
  --region ca-central-1
```

### Apply Terraform changes

```bash
# Global ECR (rarely needed)
cd infra/global/ecr
terraform init && terraform plan && terraform apply

# Global IAM (rarely needed)
cd infra/global/iam
terraform init && terraform plan && terraform apply

# Staging environment
cd infra/environments/staging
terraform init && terraform plan && terraform apply
```

Always run `plan` before `apply` and review the diff — particularly for changes to the ECS task definition, RDS, or security groups.

### Rotate a secret

1. Update the SSM parameter value (see [Secrets & SSM Parameters](#secrets--ssm-parameters)).
2. Force a new ECS deployment to pick up the new value.
3. Verify the service stabilises with `aws ecs wait services-stable`.

### Roll back the API to a previous image

ECR retains the last 10 `staging-*` tagged images. Find the SHA of the last good commit, then update the ECS service to use that image tag:

```bash
# Update the task definition to use a specific SHA tag, then force a new deployment
# The easiest path is to revert the commit in git and let CI/CD re-deploy.
```

For a faster rollback without waiting for CI: update the ECS task definition manually in the AWS console to reference `staging-<previous-sha>`, then update the service to use the new task definition revision.