# Production Environment

This environment mirrors staging in architecture — same modules, same region
(`ca-central-1`), same ECR repository. The differences are:

| | Staging | Production |
|---|---|---|
| VPC CIDR | `10.0.0.0/16` | `10.1.0.0/16` |
| Frontend bucket | `finance-frontend-187844640945` | `finance-frontend-prod-187844640945` |
| Uploads bucket | `finance-uploads-187844640945` | `finance-uploads-prod-187844640945` |
| SSM prefix | `/finance` | `/finance/production` |
| Image tag | `staging-latest` | `prod-latest` |
| ECS log level | `debug` | `info` (default) |

## Deploy trigger

Production deploys are triggered by pushing a **semver git tag** (e.g. `v1.0.0`),
not by pushing to `main`. The `deploy-api.yml` and `deploy-frontend.yml` workflows
should be updated to add a tag-based trigger before this environment goes live:

```yaml
on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'
```

The image tag used in the ECS task definition will be `prod-latest` (updated by the
deploy workflow on each tagged release), in addition to the immutable
`prod-<git-sha>` tag for rollback reference.

## Pre-apply checklist

Complete every item below before running `terraform apply` for the first time.

### 1 — Resolve Route 53 conflicts with staging

Production and staging share the same hosted zone (`ryantyrrell.ca`) and currently
claim the same subdomains (`app.ryantyrrell.ca`, `api.ryantyrrell.ca`). Both cannot
exist simultaneously.

Before applying production, update `infra/environments/staging/main.tf` to use
distinct staging subdomains:

```hcl
# staging/main.tf — cloudfront module
domain_name = "staging.ryantyrrell.ca"   # was app.ryantyrrell.ca

# staging/main.tf — ecs module
cors_origin = "https://staging.ryantyrrell.ca"

# staging/main.tf — route53 module
# route53 module must also expose an api subdomain variable;
# point it at api-staging.ryantyrrell.ca
```

Apply staging with the new subdomains first, then apply production.

### 2 — Right-size the ECS task count

`desired_count` is currently `1`. Before launch, check staging CloudWatch metrics
(`MemoryUtilization`, `CPUUtilization`) under representative load and adjust here.
Common starting points for a personal-use dashboard:

- Low traffic (personal only): `desired_count = 1`, `cpu = 256`, `memory = 512`
- If you add multi-user support: re-evaluate based on observed p95 load

### 3 — Create SSM parameters

Production secrets live under `/finance/production/*` (separate from staging's
`/finance/*`). After the first `terraform apply` creates the placeholder parameters,
populate each one via CLI:

```bash
aws ssm put-parameter \
  --name "/finance/production/db-url" \
  --value "postgres://finance_admin:<password>@<rds-endpoint>:5432/finance" \
  --type SecureString \
  --overwrite

aws ssm put-parameter \
  --name "/finance/production/jwt-secret" \
  --value "$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" \
  --type SecureString \
  --overwrite

aws ssm put-parameter \
  --name "/finance/production/jwt-refresh-secret" \
  --value "$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" \
  --type SecureString \
  --overwrite

aws ssm put-parameter \
  --name "/finance/production/anthropic-key" \
  --value "<key>" \
  --type SecureString \
  --overwrite

aws ssm put-parameter \
  --name "/finance/production/openai-key" \
  --value "<key>" \
  --type SecureString \
  --overwrite

aws ssm put-parameter \
  --name "/finance/production/sentry-dsn-backend" \
  --value "<dsn>" \
  --type SecureString \
  --overwrite
```

### 4 — Set the RDS master password

After apply, the RDS instance is created with the placeholder password. Overwrite it
immediately — Terraform will never touch the password again (`ignore_changes`):

```bash
aws rds modify-db-instance \
  --db-instance-identifier production-finance-db \
  --master-user-password "<secure-password>" \
  --apply-immediately
```

Then update `/finance/production/db-url` in SSM to include the new password.

### 5 — Add `CLOUDFRONT_DISTRIBUTION_ID` to GitHub Actions secrets

After apply, retrieve the CloudFront distribution ID:

```bash
terraform output cloudfront_distribution_id
```

Add it as the GitHub Actions secret `CLOUDFRONT_DISTRIBUTION_ID_PROD` and uncomment
the cache invalidation step in `.github/workflows/deploy-frontend.yml`.

## Estimated monthly cost

All figures are approximate, based on `ca-central-1` on-demand pricing (Apr 2025).
Actual costs vary with traffic and data transfer.

| Resource | Spec | Est. cost/mo |
|---|---|---|
| ECS Fargate | 1 task × 0.25 vCPU / 512 MiB | ~$10 |
| RDS PostgreSQL 15 | `db.t3.micro`, 20 GiB gp2, single-AZ | ~$25 |
| ALB | 1 LCU baseline | ~$20 |
| NAT Gateway | 2 AZs, low traffic | ~$65 |
| CloudFront | PriceClass_100, low traffic | ~$1 |
| S3 | Two buckets, low storage | < $1 |
| **Total** | | **~$121/mo** |

> Range given in the design document: **$84–$112/month**. NAT Gateway dominates.
> If cost is a concern, collapse to a single AZ (one public + one private subnet,
> one NAT gateway) to save ~$32/month. The VPC module defaults support this —
> pass single-element lists for `public_subnet_cidrs` and `private_subnet_cidrs`.

## Multi-AZ RDS upgrade path

The RDS instance runs in single-AZ mode (`multi_az = false`). To enable Multi-AZ
for automatic failover:

1. In `infra/modules/rds/main.tf`, change:
   ```hcl
   multi_az = false
   ```
   to:
   ```hcl
   multi_az = true
   ```
2. Add a `multi_az` variable to `infra/modules/rds/variables.tf` if you want to
   control it per environment rather than globally.
3. Run `terraform plan` to confirm, then `terraform apply`.

AWS performs the conversion with a brief failover — typically under 60 seconds.
Additional cost: ~$25/month (second standby instance billed at full rate).
