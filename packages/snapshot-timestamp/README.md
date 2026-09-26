# soonwhy-snapshot-timestamp

A tiny local package used to verify the Soonwhy Verdaccio workflow.

## Local development

Start the registry:

```bash
pnpm registry:up
```

Build and publish a timestamped snapshot:

```bash
pnpm publish:local --package soonwhy-snapshot-timestamp
```

Install it from another project:

```bash
npm install soonwhy-snapshot-timestamp --registry http://localhost:4873
```

The package is intentionally small. It is a real npm package so the local registry workflow can be tested end to end.
