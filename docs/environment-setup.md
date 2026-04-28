# Environment Setup

## Prerequisites

- Node.js >= 20
- pnpm >= 9 — install via corepack (recommended, pins the exact version from `package.json`):
  ```bash
  corepack enable
  ```
- Docker Desktop

## 1. Install dependencies

```bash
pnpm install
```

## 2. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and replace the JWT secrets with generated values:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run that twice — once for `JWT_SECRET`, once for `JWT_REFRESH_SECRET`.

The web app has its own env file (optional — defaults work for local dev):

```bash
cp apps/web/.env.example apps/web/.env
```

Key API variables:

| Variable                        | Default                                                      | Notes                                                        |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `DATABASE_URL`                  | `postgresql://postgres:postgres@localhost:5434/finance_dev`  | Dev DB                                                       |
| `DATABASE_URL_TEST`             | `postgresql://postgres:postgres@localhost:5434/finance_test` | Test DB                                                      |
| `JWT_SECRET`                    | —                                                            | Generate a 32-byte hex value                                 |
| `JWT_REFRESH_SECRET`            | —                                                            | Generate a separate 32-byte hex value                        |
| `PORT`                          | `3000`                                                       | API port                                                     |
| `LOG_LEVEL`                     | `debug`                                                      | pino log level (`debug`, `info`, `warn`, `error`)            |
| `CORS_ORIGIN`                   | `http://localhost:5173`                                      | Web dev server origin                                        |
| `ENABLE_AI_CATEGORIZATION`      | `false`                                                      | Set to `true` only if you want to use AI during import       |
| `AI_PROVIDER`                   | `anthropic`                                                  | `anthropic` or `openai`                                      |
| `ANTHROPIC_API_KEY`             | —                                                            | Required when `AI_PROVIDER=anthropic` and AI is enabled      |
| `OPENAI_API_KEY`                | —                                                            | Required when `AI_PROVIDER=openai` and AI is enabled         |
| `AI_CONFIDENCE_THRESHOLD`       | `0.70`                                                       | Minimum confidence score for AI to apply a category          |
| `TRANSFER_DETECTION_WINDOW_DAYS`| `3`                                                          | Day window for matching transfer pairs                       |
| `SENTRY_DSN`                    | —                                                            | Leave blank in local dev                                     |

## 3. Start the database

```bash
docker compose up -d postgres
```

Both `finance_dev` and `finance_test` databases are created automatically on first run.

## 4. Run migrations and seed data

```bash
pnpm db:migrate                        # apply schema to finance_dev
pnpm --filter api db:migrate:test      # apply schema to finance_test
pnpm seed:rules                        # seed categorization rules (finance_dev only)
pnpm seed:dev                          # seed categories and sample transactions (finance_dev only)
```

## 5. Start the dev servers

```bash
pnpm dev
```

- API: http://localhost:3000
- Web: http://localhost:5173

## 6. Run tests

```bash
pnpm --filter api test
```

All tests should be green after completing the steps above.

---

## Other useful commands

```bash
pnpm typecheck          # Type-check all workspaces
pnpm lint               # ESLint across all workspaces
pnpm db:studio          # Open Drizzle Studio (visual DB browser) — requires the DB to be running
```

---

## Making database schema changes

After editing `apps/api/src/db/schema.ts`, generate a new migration and apply it:

```bash
pnpm db:generate                    # generates a new SQL migration file under src/db/migrations/
pnpm db:migrate                     # applies it to finance_dev
pnpm --filter api db:migrate:test   # applies it to finance_test
```

Do not rename or edit the generated migration files — Drizzle tracks them by filename.

---

## Running the production Docker image locally

This tests the `runner` stage of `apps/api/Dockerfile` — the same image that is deployed to ECS.

### Prerequisites

The postgres container must be running:

```bash
docker compose up -d postgres
```

### 1. Build the image

Run from the repo root:

```bash
docker build -f apps/api/Dockerfile --target runner -t finance-api:test .
```

### 2. Find the compose network name

The API container needs to reach postgres over Docker's internal network:

```bash
docker network ls | grep finance
```

The name will be something like `finance-dashbard_default`. Use it in the next step.

### 3. Run the container

```bash
docker run --rm \
  --network <network> \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/finance_dev \
  -e JWT_SECRET=<secret> \
  -e JWT_REFRESH_SECRET=<secret> \
  -e PORT=3000 \
  -e CORS_ORIGIN=http://localhost:5173 \
  finance-api:test
```

Use your existing `.env` values for `JWT_SECRET` and `JWT_REFRESH_SECRET`. Note the `DATABASE_URL` uses `@postgres:5432` (the service hostname inside Docker), not `@localhost:5434`.

`--rm` means the container is automatically deleted when stopped.

### 4. Verify it is working

```bash
curl http://localhost:3000/api/v1/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 5. Stop the container

Find the container name:

```bash
docker ps
```

Then stop it:

```bash
docker stop <container-name>
```

The container is removed automatically because of `--rm`.

### Running migrations from the container

This replicates the ECS migration task that runs before each deploy:

```bash
docker run --rm \
  --network <network> \
  -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/finance_dev \
  --workdir /app/apps/api \
  finance-api:test \
  node_modules/.bin/drizzle-kit migrate
```

---

## Resetting the database

To wipe and recreate both databases from scratch:

```bash
docker compose down -v
docker compose up -d postgres
pnpm db:migrate
pnpm --filter api db:migrate:test
pnpm seed:rules
pnpm seed:dev
```
