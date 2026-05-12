## Overview

Create a pull request for the changes in this session.

## Steps

1. Check for uncommitted changes. If any exist, stage and commit them with a message that describes what changed and why.
2. Push the branch to the remote.
3. Open a PR with `gh pr create`. Write a title that summarizes the change and a body that covers what changed, why, and anything a reviewer should know. If the repo has a PR template, follow it.
4. Report the PR URL when done. Wrap the URL in a `<pr-created>` tag on its own line so the UI can render a live status card, like this: `<pr-created>https://github.com/owner/repo/pull/123</pr-created>`
5. Remove the worktree after the PR is created so the user can review the PR directly on GitHub without leftover local state.

If a PR already exists for this branch, push any new commits and report the existing URL wrapped in the same `<pr-created>` tag instead of creating a duplicate.

## Target

Repository: ryan3971/finance-dashboard
Branch: claude/mystifying-darwin-b62918
Working directory: C:\Users\rbt7r\OneDrive\Documents\VSCode Workspace\Finance Dashbard\.claude\worktrees\mystifying-darwin-b62918

---

## Worktree setup (run first when working directory is a worktree)

Worktrees have no `node_modules` and no `.env`. Both are required by the pre-commit and pre-push hooks. Before staging any commit, run the following from PowerShell:

```powershell
$worktree = "<absolute path to worktree>"
$main     = "C:\Users\rbt7r\OneDrive\Documents\VSCode Workspace\Finance Dashbard"

# Link node_modules so lint-staged and ESLint can resolve types
cmd /c mklink /J "$worktree\node_modules"                    "$main\node_modules"
cmd /c mklink /J "$worktree\apps\api\node_modules"           "$main\apps\api\node_modules"
cmd /c mklink /J "$worktree\apps\web\node_modules"           "$main\apps\web\node_modules"
cmd /c mklink /J "$worktree\packages\shared\node_modules"    "$main\packages\shared\node_modules"

# Copy .env so the pre-push test suite can connect to the test DB
Copy-Item "$main\apps\api\.env" "$worktree\apps\api\.env"
```

Skip this block if `node_modules` already exists in the worktree (i.e. junctions were created earlier in the session).

## Bruno files

The Bruno collection lives in the monorepo root only (`C:\Users\rbt7r\OneDrive\Documents\VSCode Workspace\Finance Dashbard\bruno\`) and is **not** present in worktrees. Any Bruno requests added during the session must be committed from the main project directory, not from the worktree. Stage and commit them separately before or after the worktree commit.

## Pre-push test verification (run before committing)

Run the targeted test file from the **main project** directory (where `node_modules` and `.env` are always present) to catch expectation errors before they surface in the pre-push hook:

```bash
cd "C:\Users\rbt7r\OneDrive\Documents\VSCode Workspace\Finance Dashbard"
pnpm --filter api test src/features/<feature>/<feature>.routes.test.ts
```

Fix any failures before staging the commit.

## Worktree teardown (run after PR is created)

Once the PR URL has been reported, unregister the worktree from git and remove the node_modules junctions. The directory itself cannot be deleted while the Claude Code session is running inside it — Windows holds a lock on the process's working directory. Run the following, then tell the user to close the session; the directory will be gone after they do.

```powershell
$worktree = "<absolute path to worktree>"
$main     = "C:\Users\rbt7r\OneDrive\Documents\VSCode Workspace\Finance Dashbard"

# Remove junctions first — rmdir on a junction removes only the link, not the target.
cmd /c rmdir "$worktree\node_modules"
cmd /c rmdir "$worktree\apps\api\node_modules"
cmd /c rmdir "$worktree\apps\web\node_modules"
cmd /c rmdir "$worktree\packages\shared\node_modules"

# Unregister the worktree from git (directory stays but git stops tracking it).
Set-Location $main
git worktree remove --force $worktree
```

After the session closes, the user can delete any leftover directory with:

```powershell
Remove-Item -Recurse -Force "<absolute path to worktree>"
```
