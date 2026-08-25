---
name: test-pruning
description: >
  Multi-model approach to pruning a test suite. Uses multiple AI models to
  explain, justify, and stack rank tests by value, then consolidates into
  one final plan with objective justifications. Use when: reviewing a test
  suite for removal candidates, pruning redundant tests, or optimizing
  test coverage.
---

# Test Pruning

A multi-model approach to pruning test suites without single-model bias.

## The Problem

AI models tend to be overly protective of existing tests. Asking one model
to "review and prune" usually results in keeping everything and adding more.
You need adversarial review.

## The Pattern

### Step 1: Explain & Justify

Ask a model (GPT-5, Claude, etc.) to:

```
Explain and justify each test in our test suite.
Stack rank tests by value and provide candidates for removal.
```

Output: A ranked list with justification for each test.

### Step 2: Identify Removals

Ask the same model:

```
Can you add this document as a GitHub discussion via CLI?
```

This creates a persistent record of the analysis.

### Step 3: Consolidate

In a fresh thread, use a different model (ideally the strongest available):

```
Pull both discussion documents and consolidate one set of changes.
Every addition and removal must be justified objectively.
Make one final plan with the step-by-step changes.
You're the best model possible to do this with and I trust your judgement.
```

Output: A single, defensible plan with objective justifications.

## Why Multiple Models

- Avoids single-model blind spots
- Creates adversarial review pressure
- Produces defensible decisions
- Different models have different test-value heuristics

## Example Flow

```
1. GPT-5 → explain & justify 340 tests → discussion #1
2. Claude → explain & justify 340 tests → discussion #2
3. Opus 5 Max → consolidate both → final plan
```

## Output Format

The final plan should include:

- Tests to remove (with objective justification)
- Tests to keep (with value ranking)
- Tests to modify (with rationale)
- Estimated reduction (e.g., "340 → 280 tests")

## When to Use

- Test suite feels bloated
- CI is slow due to test count
- Before major refactors
- Onboarding new team members (forces documentation)
