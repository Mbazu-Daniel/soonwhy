---
name: git-hygiene
description: >
  Prevents AI agents from poisoning git history. Hardcodes author/committer,
  blocks third-party attribution trailers (Co-authored-by: Cursor, factory-droid,
  etc.), wires pre-commit/commit-msg hooks. Requires branch and commit names
  that describe the code change — not phase/epic/scratch labels. Use when:
  setting up a repo for AI-assisted development, reviewing commits for
  attribution pollution, naming branches/commits, or configuring git hooks to
  enforce clean history.
---

# Git Hygiene

AI agents will poison your git history. Every `Co-authored-by: Cursor` or
`Co-authored-by: factory-droid` trailer is noise that dilutes blame, breaks
`git log --author`, and clutters `git shortlog -sn`. This skill hardens
your repo against it.

## The Problem

When AI tools commit code, they inject attribution trailers:

```
feat: add user authentication

Co-authored-by: Cursor <cursor@cursor.com>
Co-authored-by: factory-droid <factory@factory.ai>
```

These accumulate. After a month your `git log` reads like a conference
attendee list, not a changelog. `git blame` still works, but
`git shortlog -sn` is useless, and bisecting with `--author` becomes
impossible.

## The Fix

### 1. Hardcode author and committer

Set your identity in `.git/config` so AI agents can't override it:

```bash
git config user.name "Daniel"
git config user.email "your@email.com"
```

For CI, set `GIT_AUTHOR_NAME` and `GIT_COMMITTER_NAME` env vars.

### 2. Install husky + commitlint

```bash
pnpm add -Dw husky @commitlint/cli @commitlint/config-conventional
npx husky init
```

This creates `.husky/` directory and adds `"prepare": "husky"` to package.json.

### 3. Configure commitlint

Create `commitlint.config.js`:

```js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation only
        'style',    // Formatting, no code change
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf',     // Performance improvement
        'test',     // Adding or updating tests
        'build',    // Build system or external dependencies
        'ci',       // CI configuration
        'chore',    // Other changes that don't modify src or test
        'revert',   // Reverts a previous commit
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
  },
};
```

### 4. Create husky hooks

**`.husky/pre-commit`** — Runs existing pre-commit checks:

```sh
#!/bin/sh
/home/daniel/Documents/projects/soonwhy/.githooks/pre-commit
```

**`.husky/commit-msg`** — Validates conventional commits + blocks AI attribution:

```sh
#!/bin/sh
/home/daniel/Documents/projects/soonwhy/node_modules/.bin/commitlint --edit "$1"
/home/daniel/Documents/projects/soonwhy/.githooks/commit-msg "$1"
```

### 5. Block attribution trailers (commit-msg hook)

Create `.githooks/commit-msg` (used by husky as backup):

```bash
#!/bin/sh
# Block AI attribution trailers
MSG_FILE="$1"
DIRTY=0

for pattern in \
  "^Co-authored-by:.*cursor" \
  "^Co-authored-by:.*factory-droid" \
  "^Co-authored-by:.*copilot" \
  "^Co-authored-by:.*claude" \
  "^Co-authored-by:.*gpt" \
  "^Co-authored-by:.*ai\." \
  "^Co-authored-by:.*bot" \
  "^Authored-by:.*cursor" \
  "^Authored-by:.*factory-droid" \
  "^Signed-off-by:.*cursor" \
  "^Signed-off-by:.*factory-droid"
do
  if grep -qiE "$pattern" "$MSG_FILE"; then
    echo "BLOCKED: AI attribution trailer detected: $pattern"
    DIRTY=1
  fi
done

if [ "$DIRTY" -eq 1 ]; then
  echo ""
  echo "Remove AI attribution trailers before committing."
  echo "Your identity is already set via git config user.name/email."
  exit 1
fi
```

### 6. Block large commits (pre-commit hook)

Create `.githooks/pre-commit`:

```bash
#!/bin/sh
MAX_FILES=50

# Count staged files (excluding deletes)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=d | wc -l)

if [ "$STAGED_FILES" -gt "$MAX_FILES" ]; then
  echo "BLOCKED: $STAGED_FILES files staged (max: $MAX_FILES)"
  echo ""
  echo "Split into smaller commits. Each commit should be atomic."
  echo "Use 'git reset HEAD' to unstage, then commit in batches."
  exit 1
fi

# Warn if signing not enabled
if ! git config --get commit.gpgSign > /dev/null 2>&1; then
  echo "WARNING: Commit signing not enabled. Run:"
  echo "  git config commit.gpgSign true"
fi
```

### 7. Enforce hook activation

Add to your setup script or CI:

```bash
git config core.hooksPath .githooks
```

Or run once per clone:

```bash
git config core.hooksPath .githooks
```

### 8. Add to skill for other agents

When onboarding a new AI agent to the repo, run:

```bash
# Verify hooks are active
ls -la .githooks/
git config core.hooksPath

# Verify identity
git config user.name
git config user.email
```

## Branch and commit naming

Name branches and commits from **what the code changes**, not from planning metadata.

Scratch dirs like `.scratch/phase-1/` or `.scratch/phase-2/issues/02-…` are local org only. Do **not** put `phase-1`, `phase-2`, epic numbers, or raw ticket filenames into:

- branch names
- commit subjects (or PR titles)

| Bad | Good |
| --- | --- |
| `phase-2` / `phase2-clickhouse` | `feat/clickhouse-client` |
| `feat: phase 2 issue 02` | `feat: add ClickHouse client` |
| `feat/nestjs-clickhouse-module` | `feat/clickhouse-client` |
| `02-clickhouse-module` (ticket file alone) | `feat/clickhouse-client` |

Derive the slug from the capability or bug fixed — not the framework wrapper, phase, or ticket filename. Conventional commits (`feat`/`fix`/…) still apply; the subject must describe the change.

## Agent Checklist

When an agent makes a commit, verify:

- [ ] No `Co-authored-by:` trailers in commit message
- [ ] Branch name and commit subject describe the code change (not phase/epic/scratch labels)
- [ ] `git config user.name` matches expected developer
- [ ] `git config user.email` matches expected developer
- [ ] `.githooks/commit-msg` is executable
- [ ] `core.hooksPath` points to `.githooks/`

## Files Created

```
.husky/
├── _/                  # Husky internal
├── pre-commit          # Runs commitlint + pre-commit checks
└── commit-msg          # Validates conventional commits + blocks AI attribution

.githooks/
├── commit-msg        # Blocks AI attribution trailers (backup)
├── pre-commit        # Ensures signing is enabled
└── pre-merge-commit  # Blocks AI attribution trailers (PR merges)

commitlint.config.js    # Conventional commit rules

.agents/skills/git-hygiene/
└── SKILL.md          # This skill
```

## Verify

After setup:

```bash
# Test the hook
echo "feat: add thing

Co-authored-by: Cursor <cursor@cursor.com>" | .githooks/commit-msg /dev/stdin
# Should exit 1 with BLOCKED message
```
