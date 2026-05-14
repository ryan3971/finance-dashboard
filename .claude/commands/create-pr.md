## Overview

Create a pull request for the changes in this session.

If `/worktree-init` has not been run yet this session, run it before staging any commits.

## Steps

1. Check for uncommitted changes. If any exist, stage and commit them with a message that describes what changed and why.
2. Create a branch that appropriately names the change and push it to remote.
3. Open a PR with `gh pr create`. Write a title that summarizes the change and a body that covers what changed, why, and anything a reviewer should know. If the repo has a PR template, follow it.
4. Report the PR URL when done. Wrap the URL in a `<pr-created>` tag on its own line so the UI can render a live status card, like this: `<pr-created>https://github.com/owner/repo/pull/123</pr-created>`
5. Remove the worktree after the PR is created so the user can review the PR directly on GitHub without leftover local state.

If a PR already exists for this branch, push any new commits and report the existing URL wrapped in the same `<pr-created>` tag instead of creating a duplicate.

## Target

Repository: ryan3971/finance-dashboard
Branch: claude/mystifying-darwin-b62918
Working directory: C:\Users\rbt7r\OneDrive\Documents\VSCode Workspace\Finance Dashbard\.claude\worktrees\mystifying-darwin-b62918

---

## Bruno files

The Bruno collection lives in the monorepo root only (`C:\Users\rbt7r\OneDrive\Documents\VSCode Workspace\Finance Dashbard\bruno\`) and is **not** present in worktrees. Any Bruno requests added during the session must be committed from the main project directory, not from the worktree. Stage and commit them separately before or after the worktree commit.

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
