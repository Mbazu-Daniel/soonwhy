# Git Strategy

This document defines the branching model, commit conventions, PR workflow, and merge strategy for the Soonwhy monorepo.

## Branching Model

```
main          ← production-ready, protected
  └── dev     ← integration branch, protected
       ├── feature/*
       ├── fix/*
       └── chore/*
```

- **main** — stable release branch. Direct pushes blocked. All changes arrive via PR from `dev`.
- **dev** — integration branch. Feature branches merge here first. Direct pushes blocked.
- **feature/\***, **fix/\***, **chore/\*** — short-lived topic branches created from `dev`.

## Branch Naming Conventions

Format: `<type>/<short-description>`

| Type | Use case | Example |
|------|----------|---------|
| `feature/` | New functionality | `feature/user-avatar-upload` |
| `fix/` | Bug fix | `fix/login-redirect-loop` |
| `chore/` | Maintenance, deps, config | `chore/update-vitest` |

Rules:
- Lowercase, kebab-case only.
- Keep it under 50 characters.
- Prefix with the issue number when available: `feature/22-git-strategy`.

## Commit Conventions

All commits follow [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructuring (no feature or fix) |
| `test` | Adding or updating tests |
| `chore` | Build, tooling, dependencies |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |

### Scope

Use the package name when the change is isolated: `feat(frontend)`, `fix(backend)`. Omit scope for monorepo-wide changes.

### Rules

- Subject line: imperative mood, lowercase, no period, max 72 characters.
- Body: wrap at 80 characters. Explain *what* and *why*, not *how*.
- Footer: reference issues with `Closes #123` or `Refs #123`.

### Examples

```
feat(frontend): add user avatar upload component

Closes #14
```

```
fix(backend): prevent duplicate session creation on retry

The previous implementation did not handle idempotency keys
on concurrent requests, leading to duplicate rows.

Refs #8
```

## PR Workflow

1. Create a topic branch from `dev`:
   ```
   git checkout dev && git pull
   git checkout -b feature/short-description
   ```
2. Make changes, commit with conventional commits.
3. Push and open a PR targeting `dev`.
4. Fill in the PR template (see below).
5. Address review feedback until approved.
6. Squash merge into `dev`.
7. Delete the topic branch after merge.

### PR Template

```markdown
## Description

<What does this PR do?>

## Related Issue

Closes #<issue-number>

## Changes

- Bullet list of changes

## Testing

- [ ] Unit tests pass
- [ ] Manual testing done (describe below if needed)

## Checklist

- [ ] Code follows project conventions
- [ ] No console logs or debug artifacts
- [ ] Self-reviewed the diff
```

## Code Review Requirements

- **Minimum 1 approval** required before merge.
- Reviewers should check: correctness, readability, test coverage, security implications.
- PR author resolves all comments before merge.
- Stale approvals are dismissed when new commits are pushed (enforce via branch protection).

## Merge Strategy

| Source | Target | Strategy |
|--------|--------|----------|
| Topic branch | `dev` | **Squash merge** — keeps `dev` history clean with one commit per feature. |
| `dev` | `main` | **Merge commit** — preserves integration history with a merge commit for traceability. |

Rationale: Squash merge on topic branches avoids noisy intermediate commits. Merge commit on `dev → main` preserves the full development timeline.

## Protected Branches

### main

- Require pull request before merging.
- Require at least 1 approval.
- Require status checks to pass (CI).
- Require branch to be up to date before merging.
- Restrict who can push: nobody (CI-only for releases).
- Do not allow force pushes or branch deletion.

### dev

- Require pull request before merging.
- Require at least 1 approval.
- Require status checks to pass (CI).
- Do not allow force pushes or branch deletion.

## CI/CD Integration

Every PR must pass the following checks before merge:

| Check | Description |
|-------|-------------|
| `lint` | `pnpm lint` (oxlint) |
| `format` | `pnpm format --check` (oxfmt) |
| `typecheck` | `pnpm typecheck` (tsc) |
| `test` | `pnpm test` (vitest) |
| `build` | `pnpm build` |

Status checks are enforced on both `main` and `dev` via branch protection rules.

## AI Agent Guidelines

Agents must:
- Hardcode author/committer (see `.agents/skills/git-hygiene/`).
- Never add `Co-authored-by` trailers.
- Follow conventional commit format exactly.
- Create branches from `dev`, never from `main`.
