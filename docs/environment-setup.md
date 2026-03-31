docker compose down -v
docker compose up -d postgres
pnpm --filter api db:migrate          # schema on finance_dev
pnpm --filter api db:migrate:test     # schema on finance_test
pnpm --filter api db:seed             # categories on finance_dev
pnpm --filter api db:seed:test        # categories on finance_test
pnpm seed:rules                       # rules on finance_dev only
pnpm seed:dev                         # seed data on finance_dev only
pnpm --filter api test                # should be green