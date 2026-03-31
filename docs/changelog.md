# Changelog

Pre-commit (.husky/pre-commit):

- lint-staged — runs ESLint with --fix on staged .ts/.tsx files only (fast, not the whole repo). Fails on any remaining errors or warnings after auto-fix.
- pnpm typecheck — runs tsc --noEmit across both api and web workspaces.

Pre-push (.husky/pre-push):

- pnpm test — runs the full Vitest suite. Kept out of pre-commit because API tests need the database.
Tests are in pre-push rather than pre-commit so normal WIP commits aren't blocked by the DB requirement. If you ever want to skip hooks for a one-off commit (e.g. a docs change), you can use git commit --no-verify.
---
