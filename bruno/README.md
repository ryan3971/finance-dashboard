# Finance Dashboard — Bruno Collection

API collection for the Finance Dashboard. Uses the [OpenCollection](https://www.opencollection.dev/) format (`.yml` files).

## Prerequisites

- [Bruno](https://www.usebruno.com/) desktop app installed
- API running locally (see repo root `pnpm dev`)

## Importing the Collection

1. Open Bruno
2. Click **Open Collection** from the home screen (or **File → Open Collection**)
3. Navigate to and select the `bruno/` folder in this repo
4. Bruno detects `opencollection.yml` automatically and loads the collection
5. In the top-right environment picker, select **dev**

## Environment Configuration

The `dev` environment is pre-configured and ready to use out of the box.

| Variable | Value | Notes |
|---|---|---|
| `localhost` | `http://localhost:3000` | Change if your API runs on a different port |
| `token` | *(auto-set)* | Populated automatically by login/register — do not set manually |
| `amexAccountId` | *(UUID)* | Matches seeded dev data — update if your seed differs |
| `cibcAccountId` | *(UUID)* | Matches seeded dev data |
| `questTsfaAccountId` | *(UUID)* | Matches seeded dev data |
| `questFhsaAccountId` | *(UUID)* | Matches seeded dev data |
| `questRrspAccountId` | *(UUID)* | Matches seeded dev data |
| `tdAccountId` | *(UUID)* | Matches seeded dev data |

The `production` environment exists as a placeholder with no variables defined.

## Collection Structure

Folders are listed in display order.

| Folder | Description |
|---|---|
| `auth` | Register, login, logout, and token refresh |
| `health` | Health check endpoint |
| `account` | List, create, update, deactivate, and reactivate accounts |
| `imports` | Upload CSV bank exports |
| `transactions` | List, create, update, delete, and manage tags on transactions |
| `categories` | List, create, update, and delete categories |
| `transfers` | Confirm, dismiss, or unmark detected transfer pairs |
| `tags` | List, create, and delete user-defined tags |
| `anticipated-budget` | CRUD for budget entries and per-month overrides |
| `user-config` | Get, update, and reset user config and allocation percentages |
| `dashboard` | Snapshot, income, expenses, expense categories, and YTD aggregates |
| `rebalancing` | Manage rebalancing groups and their linked transactions |
| `categorization-rules` | List, update, and delete auto-categorization rules |
| `seed` | Trigger dev seed data load via the API |

There is also a top-level `sentry-test` request that hits `/debug-sentry` — useful only for verifying that Sentry error tracking is wired up correctly.

## Typical Workflow

1. Start the API from the repo root:
   ```bash
   pnpm dev
   ```
2. In Bruno, select the **dev** environment
3. **First time:** run `auth → register` to create an account; subsequent runs use `auth → login`
   - Both requests automatically store the returned `accessToken` in `{{token}}` via an after-response script
4. All other requests use `{{token}}` as a Bearer token — no manual copy-paste needed
5. When the token expires, run `auth → refresh` to get a new one (also auto-stored)
6. To seed realistic data before exploring the dashboard and transaction endpoints, run `pnpm seed:dev` from the repo root
