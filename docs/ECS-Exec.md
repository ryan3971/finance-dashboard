**ECS Exec — Usage Notes**

---

**Prerequisites**

- AWS CLI v2.3.6 or later
- Session Manager plugin installed in WSL: `session-manager-plugin --version`
- IAM user must have `ecs:ExecuteCommand` permission
- Task role must have `ssmmessages:CreateControlChannel`, `ssmmessages:CreateDataChannel`, `ssmmessages:OpenControlChannel`, `ssmmessages:OpenDataChannel`
- `enable_execute_command = true` on the ECS service (managed by Terraform)

---

**Get the running task ID**

```bash
aws ecs list-tasks \
  --cluster staging-finance \
  --service-name staging-finance-api \
  --query 'taskArns[0]' \
  --output text \
  --region ca-central-1
```

---

**Verify the task is exec-ready**

```bash
aws ecs describe-tasks \
  --cluster staging-finance \
  --tasks <TASK_ID> \
  --query 'tasks[0].containers[0].managedAgents' \
  --region ca-central-1
```

`lastStatus` must be `RUNNING` before exec will work.

---

**Open an interactive shell**

```bash
aws ecs execute-command \
  --cluster staging-finance \
  --task <TASK_ID> \
  --container finance-api \
  --interactive \
  --command "/bin/sh" \
  --region ca-central-1
```

---

**Inside the container — useful commands**

Verify environment variables are injected:

```bash
echo $DATABASE_URL
echo $NODE_ENV
```

Run a one-off seed or backfill script:

```bash
cd /app/apps/api
node dist/db/seed.js
node dist/db/seed-system.js
```

Connect to RDS via psql (if psql is available in the image):

```bash
psql $DATABASE_URL
```

Exit the container:

```bash
exit
```

---

**Troubleshooting — `TargetNotConnected`**

Run the official AWS ECS Exec checker:

```bash
curl -o ecs-exec-checker.sh https://raw.githubusercontent.com/aws-containers/amazon-ecs-exec-checker/main/check-ecs-exec.sh
chmod +x ecs-exec-checker.sh
./ecs-exec-checker.sh staging-finance <TASK_ID>
```

Common causes:

- Task was started before `enable_execute_command` was applied — force a new deployment
- Task role missing `ssmmessages:*` permissions — check IAM policy
- `ExecuteCommandAgent` not yet `RUNNING` — wait and recheck managed agent status

---

**Important notes**

- ECS Exec does **not** require the SSM agent to be installed in your Docker image — ECS Fargate bind-mounts the agent binaries automatically
- All commands run as `root` inside the container
- Sessions have a 20 minute idle timeout
- Every exec session is logged to CloudTrail — there is an audit trail of who accessed which container and when
- `tsx` is not available in the production image — seed scripts must be compiled into `dist/` or run via Node directly
- `DATABASE_URL` and all other SSM secrets are already injected as environment variables — no manual credential setup needed inside the container
