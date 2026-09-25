---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch. If you need a new branch, name it from the capability (e.g. `feat/clickhouse-client`), never from a phase/epic, `.scratch/` path, or framework label. Commit subjects must describe the change the same way — see AGENTS.md and the git-hygiene skill.
