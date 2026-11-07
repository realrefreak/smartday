---
name: preview-and-ship
description: Ships a finished SmartDay feature branch through a pull request. Runs quick local checks (lint + unit/DB tests), pushes the branch, opens a pull request and turns on auto-merge. GitHub then does the rest by itself, even if this session ends - CI, the preview deploy, all E2E tests on the live preview, the merge and the production deploy. Finishes in a few minutes and reports the PR link. Reports failures instead of fixing code. Use when the work is committed on a feature branch. Give it a short summary of the change for the pull request.
tools: Bash, Read, Grep, Glob
---

You hand a finished SmartDay feature branch over to GitHub, which ships it. SmartDay is a Next.js 16 app (JavaScript, Drizzle + Neon Postgres, Better Auth) deployed on Vercel by GitHub Actions.

**How shipping works now.** Everything slow happens on GitHub, not here, so it keeps going even if this Claude session closes:
- `.github/workflows/ci.yml` runs on the pull request: "Lint, unit tests, E2E tests", then "Deploy a preview with its own database", then "E2E tests on the preview" (every E2E test against the live preview).
- A ruleset on `main` requires "Lint, unit tests, E2E tests" and "E2E tests on the preview" to pass. With auto-merge on, GitHub merges the PR (rebase) the moment both pass, and the push to `main` runs the production deploy (database migration, then Vercel).
- So your job is short: check, push, open the PR, turn on auto-merge, report. **Do not wait for CI, the preview, the merge or the deploy.** Never run long waits (`gh run watch`, `gh pr checks --watch`, polling loops, local Playwright).

Work from the repository root with the Bash tool (Git Bash on Windows, POSIX syntax). Never print the contents of `.env.local` or any secret or connection string. Never edit code: if something fails, report it.

On Windows, the GitHub CLI is often missing from Git Bash's PATH. Start every Bash call that uses `gh` with `export PATH="$PATH:/c/Program Files/GitHub CLI" && ...`.

**Never get stuck waiting.** Nobody is watching this terminal, so a command that waits for input (a password, a login code, a "continue? y/n", an editor) hangs until the session dies. To stop that:
- Start every Bash call with `export GIT_TERMINAL_PROMPT=0 GH_PROMPT_DISABLED=1 GIT_EDITOR=true CI=1 &&`. With these, git and gh fail with an error instead of asking, and that error is something you can report.
- Give every Bash call a `timeout` (120000 ms is plenty; 300000 for the Vitest run). If a command times out, don't retry it in a loop: report which step hung.
- Never start a login or any command that opens a browser (`gh auth login`, `vercel login`, `vercel link`, `npx vercel ...`). If something needs signing in, stop and tell the user.
- Use `npx --no-install` so npx never asks to download a package.
- Never run a long-lived process (dev server, `--watch` mode, `gh run watch`).

## 1. Look before doing anything

- `gh auth status` must succeed. If `/c/Program Files/GitHub CLI/gh.exe` doesn't exist or it isn't logged in, stop and tell the user to run `winget install --id GitHub.cli` and then `gh auth login`.
- `git branch --show-current` must NOT be `main`. Call it BRANCH.
- `git status --short` must be empty: everything is committed. If not, stop and report what's uncommitted.
- `git fetch origin main`, then `git log --oneline origin/main..HEAD` shows what will ship. If it's empty, stop: nothing to ship.
- `git merge-base --is-ancestor origin/main HEAD` must succeed. If main has moved on, stop and say the branch needs updating first.
- `git diff --name-only origin/main...HEAD` must not include any `.env*` file other than `.env.example`, anything in `.vercel/`, `test-results/`, `playwright-report/` or `node_modules/`. Changes under `.claude/` are fine.

## 2. Check new database migrations

Auto-merge means nobody looks at a migration before it runs on production, so this check matters. For each new `.sql` file under `drizzle/` in `git diff --name-only origin/main...HEAD` (ignore `drizzle/meta/`):

- Read it. While production deploys, the old code runs against the new schema, so migrations must only ADD things. Stop and report (do not push) if it contains `DROP`, `RENAME`, `ALTER COLUMN ... TYPE`, `SET NOT NULL`, or adds a `NOT NULL` column without a `DEFAULT`, unless the request explicitly says that's intended. A `CHECK` constraint on a new column or table with a valid default is fine.
- `db/schema.js` must have changed in the same branch.

## 3. Quick local checks

These take about a minute and catch most mistakes before using CI time. Stop at the first failure.

1. `npm run lint`
2. `npx --no-install vitest run`

Skip local Playwright: CI runs the full E2E suite twice (on a local build and on the live preview).

## 4. Push, open the pull request, turn on auto-merge

- `git push -u origin BRANCH` (never `--force`).
- If `gh pr view BRANCH --json number,state` shows an open pull request, reuse it. (An error saying "no pull requests found" is normal for a new branch.) Otherwise create one with `gh pr create --base main --head BRANCH --title "<short title>" --body-file -` and a heredoc body: what changed and why in plain language, any migration that will run on production, and how it was tested. End the body with a blank line and then:

  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- `gh pr merge NUMBER --auto --rebase --delete-branch` turns on auto-merge.
- Confirm it took: `gh pr view NUMBER --json state,autoMergeRequest --jq '{state, auto: (.autoMergeRequest != null)}'`. Expect `state` OPEN with `auto` true. If `state` is already MERGED, that is wrong (it skipped the checks): report it prominently. If auto-merge couldn't be turned on, report the error; the user can merge by hand once checks pass.
- `git switch main` so the local repo isn't left on the feature branch. (The branch is deleted on GitHub after the merge; the local copy can be removed later with `git branch -d BRANCH` once merged.)

## 5. Report

End with a short report:
- Handed off or not, and at which step it stopped if not.
- Local results (e.g. "lint ok, 269 unit/DB tests passed").
- Pull request URL, and that it will merge itself once "Lint, unit tests, E2E tests" and "E2E tests on the preview" pass (usually 10-15 minutes), then deploy to production.
- Any migration that will run on production.
- How to check later: `gh pr checks NUMBER` and `gh run list --branch main --limit 1`, or the PR page.
