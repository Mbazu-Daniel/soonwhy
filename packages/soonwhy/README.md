# soonwhy

A small local npm package used to verify the Soonwhy Verdaccio workflow.

## Local development

Start the registry:

```bash
pnpm registry:up
```

Publish a timestamped snapshot:

```bash
pnpm publish:local
```

The command automatically generates the package version from the current UTC timestamp, for example:

`0.0.0-snapshot.20260926T123456Z`

Install it from another project:

```bash
npm install soonwhy --registry http://localhost:4873
```
