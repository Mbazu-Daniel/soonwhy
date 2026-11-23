# Quarantine policy

Tests that protect data, migrations and ingestion run in the `integration-tests` job. This file is the only place a failing test may be set aside.

## The rule

A failing test is handled in one of two ways, and nothing else:

1. Fix it in the pull request that broke it.
2. Skip it with `it.skip` and a comment that names this file, then add an entry below within 7 days of the first failure.

A skip is never silent. Every skipped test has an entry here with an owner and a date it is due back.

## What is not allowed

- `continue-on-error` on the integration job or on any step in it.
- Removing the `integration-tests` job, or making it non-required, without a written decision. The decision is a dated entry in the "Decisions" section below, signed by the repository owner.
- Retrying a test until it passes instead of finding why it fails.

## Quarantined tests

| Test | Skipped since | Owner | Due back | Why |
|---|---|---|---|---|
| none | | | | |

## Decisions

None. The job has not been removed or made non-required.

## Required checks on `dev`

The repository owner sets these in GitHub, under Settings, Branches, the rule for `dev`, "Require status checks to pass before merging". Select these three:

- [ ] `checks`
- [ ] `integration-tests`
- [ ] `ui-smoke`
- [ ] `eval-gate` (from `.github/workflows/eval.yml`; add it only after it has passed once on `dev`)

Also tick "Require branches to be up to date before merging".

### Order to apply them

Applying them in the wrong order leaves `dev` red or blocks every pull request. Go in this order:

1. `dev` is green: lint, migrations check, unit tests and build all pass on the latest commit of `dev`.
2. The `integration-tests` job is restored and has passed on `dev` at least once.
3. Only then turn on the three required checks.

If a check name is missing from the list in GitHub, it has not run on a recent commit. Run the workflow first, then come back.
