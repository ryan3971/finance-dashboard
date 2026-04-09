# Environment Setup

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
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

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5434/finance_dev` | Dev DB |
| `DATABASE_URL_TEST` | `postgresql://postgres:postgres@localhost:5434/finance_test` | Test DB |
| `JWT_SECRET` | — | Generate a 32-byte hex value |
| `JWT_REFRESH_SECRET` | — | Generate a separate 32-byte hex value |
| `PORT` | `3001` | API port |
| `CORS_ORIGIN` | `http://localhost:5173` | Web dev server origin |
| `ENABLE_AI_CATEGORIZATION` | `false` | Set to `true` only if you want to use AI during import |
| `AI_PROVIDER` | `anthropic` | `anthropic` or `openai` |

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

- API: http://localhost:3001
- Web: http://localhost:5173

## 6. Run tests

```bash
pnpm --filter api test
```

All tests should be green after completing the steps above.

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
