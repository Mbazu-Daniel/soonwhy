# Soonwhy

OpenTelemetry-native observability with detection, evidence-gated AI analysis, and a service-map UI.

## Stack

- `apps/api` — NestJS ingestion/query API (PostgreSQL + Drizzle)
- `apps/ui` — TanStack Start dashboard
- `packages/ingest` — OTLP ingestion worker (NATS → Quickwit/Object storage)
- `sdk/node` — @soonwhy/node, Node SDK (OTLP traces)
- `sdk/nest` — @soonwhy/nest, NestJS integration
- `sdk/next` — @soonwhy/next, Next.js App Router integration
- `sdk/vite` — @soonwhy/vite, Vite dev-server integration
- `packages/shared` — shared contracts and PII field encryption

## Quick start

```bash
pnpm install
make local        # lightweight: Postgres + Redis + API + UI
make local-logs   # follow logs
make local-down   # stop
```

Full telemetry pipeline:

```bash
make observability-build
make observability-logs
make observability-down
```

## Send your first telemetry

1. Create a project in the dashboard and copy its API key.
2. Install the SDK for your framework: `@soonwhy/node`, `@soonwhy/nest`, `@soonwhy/next` or `@soonwhy/vite`.
3. Start it before your app code loads:

```ts
import { initNode } from "@soonwhy/node";

const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY!,
  endpoint: process.env.SOONWHY_ENDPOINT, // optional
  serviceName: "orders-api",
  environment: "production",
});

process.once("SIGTERM", async () => {
  await sdk.shutdown(); // flushes pending telemetry
  process.exit(0);
});
```

- `apiKey` is required. `SOONWHY_API_KEY` and `SOONWHY_ENDPOINT` are names we suggest for your own app. The SDK does not read them itself.
- `endpoint` defaults to `https://ingest-soonwhy.oktopals.com/v1`. For a local stack use `http://localhost:3002/v1`. The SDK appends `/traces`, `/logs` or `/metrics`.
- Uncaught exceptions and unhandled rejections are captured automatically.
- Other languages: send OTLP/HTTP to the ingest URL with the header `Authorization: Bearer <project API key>`. The dashboard's onboarding page shows ready-made snippets for Python, Go and others.
- Per-package options are in `sdk/*/README.md` (local only).

## Environment variables

Copy `.env.example` for local work or `.env.backend.example` for the production stack. Everything below is read by the code. Defaults are shown where the code sets one. Blank means no default.

**Required in production**

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | api, ingest | Postgres connection string. Add `?sslmode=require` for managed providers |
| `REDIS_URL` | api, ingest | Rate limits, cron leases, caches |
| `BETTER_AUTH_SECRET` | api | Session signing secret. The API refuses to start without it |
| `BETTER_AUTH_URL` | api | Public API origin |
| `FRONTEND_URL` | api | Dashboard origin, also allowed for browser uploads |
| `QUICKWIT_URL` | api, ingest | Quickwit search. Default `http://localhost:7280` outside production |
| `NATS_URL` | api, ingest | Message bus between ingest and the indexer |
| `INGEST_URL` | api | Where the API reaches ingest for health checks |

**Optional: services and limits**

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `INGEST_PORT` | 8080 / 3002 | API and ingest listen ports |
| `INGEST_INTERNAL_PORT` | | Separate port for host metrics. Publish it on localhost only |
| `INGEST_URLS` | | Comma separated ingest URLs, used only by the load-test script |
| `DB_POOL_MAX` | 10 | Connections per service |
| `DB_STATEMENT_TIMEOUT_MS`, `DB_IDLE_IN_TRANSACTION_TIMEOUT_MS` | 30000 | Postgres timeouts |
| `RATE_LIMIT_BURST`, `RATE_LIMIT_SUSTAINED` | 50 per second, 1200 per minute | API limits per caller |
| `RATE_LIMIT_PER_MINUTE` | 10000 | Ingest limit per key |
| `RATE_LIMIT_DISABLED` | | `1` turns API rate limiting off. The API warns if set in production |
| `INGEST_MAX_CONCURRENCY` | 100 | Requests ingest handles at once |
| `INGEST_MAX_CONCURRENCY_PER_ORG` | a quarter of the above | Share one organization may use |
| `INGEST_PUBLISH_BATCH_SIZE`, `INGEST_PUBLISH_MAX_BYTES` | code defaults | Size of each message published to NATS |
| `INGEST_HEALTH_TIMEOUT_MS` | 2000 | Timeout when the API checks ingest health |
| `QUICKWIT_TIMEOUT_MS` | 30000 | Quickwit request timeout |
| `NATS_STREAM_NAME` | TELEMETRY | Stream name |
| `NATS_MAX_BYTES` | 1 GiB | Stream size cap |
| `NATS_MAX_AGE_NS` | 24 hours | Message retention, in nanoseconds |
| `NATS_ACK_WAIT_NS` | 120 seconds | Redelivery wait, in nanoseconds |
| `NATS_MAX_ACK_PENDING` | 1000 | Unacknowledged messages per consumer |
| `NATS_PUBLISH_TIMEOUT_MS` | 5000 | Publish timeout |
| `NATS_CONNECT_ATTEMPTS` | 10 | Connection retries at start |
| `INDEX_STALE_MINUTES` | 60 | Minutes before an index counts as stale |
| `DETECTION_RUN_STALE_MINUTES` | 30 | Minutes before a detection run counts as stuck |
| `EVIDENCE_GRAPH_MAX_ORGS`, `EVIDENCE_GRAPH_MAX_ENTRIES` | 50, 5000 | In-memory graph bounds |
| `SYNTHETIC_PROBE_CONCURRENCY` | 10 | Probes run at once |
| `HEALTH_DETAILS_TOKEN`, `INGEST_HEALTH_TOKEN` | | Bearer tokens for the detailed health endpoints |

**Optional: storage, email and sign-in**

| Variable | Purpose |
|---|---|
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Object storage for Quickwit and uploads. `R2_PREFIX`, `R2_REGION`, `R2_FORCE_PATH_STYLE`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME` and `R2_PUBLIC_URL` tune it |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_FORCE_PATH_STYLE` | Same settings for any S3-compatible store. They take priority over the `R2_` ones |
| `STORAGE_UPLOAD_URL_TTL_SECONDS`, `STORAGE_DOWNLOAD_URL_TTL_SECONDS` | Lifetime of signed upload and download links |
| `CORS_ORIGINS` | Extra browser origins allowed to upload, comma separated |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `RESEND_FROM`, `ZEPTOMAIL_API_KEY`, `DEFAULT_FROM_EMAIL` | Outgoing email |
| `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Social sign-in. Each pair turns its provider on |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Single sign-on. All three turn it on. `OIDC_PROVIDER_ID`, `OIDC_DISPLAY_NAME`, `OIDC_SCOPES` tune it |
| `GITHUB_WEBHOOK_SECRET` | Verifies GitHub webhook deliveries |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`, `SLACK_BOT_SCOPES` | Slack app connection |
| `SOONWHY_STAFF_EMAILS`, `SOONWHY_SUPER_ADMIN_EMAILS` | Comma separated emails given platform admin roles at start. Only existing accounts are changed |
| `OPENAPI_SERVER_URL` | Server URL shown in the API docs. Default `http://localhost:8080` |

**Optional: AI**

| Variable | Default | Purpose |
|---|---|---|
| `SOONWHY_PII_ENCRYPTION_KEY` | | Encrypts personal fields and stored AI keys. Bring-your-own-key AI needs it |
| `SOONWHY_AI_QUOTA_ENFORCED` | false | Enforce per-organization AI quotas |
| `SOONWHY_AI_ALLOWED_BASE_HOSTS` | | Extra provider hosts, comma separated, for your own gateway |
| `SOONWHY_AI_TOKEN_RESERVE` | 8000 | Tokens reserved per request |
| `SOONWHY_AI_VERIFY_TIMEOUT_MS` | 8000 | Timeout when checking a stored key |
| `SOONWHY_AI_CATALOG_TTL_MS` | 12 hours | Model list cache |
| `SOONWHY_AI_CREDENTIAL_CACHE_TTL_MS` | 5 minutes | Decrypted key cache |
| `SOONWHY_RCA_TIMEOUT_MS`, `SOONWHY_RCA_MAX_RETRIES`, `SOONWHY_RCA_MAX_PROMPT_CHARACTERS`, `SOONWHY_RCA_PROMPT_VERSION` | code defaults | Root-cause analysis limits |

**Optional: the API's own telemetry**

| Variable | Default | Purpose |
|---|---|---|
| `SELF_OBSERVABILITY_ENABLED` | false | Send the API's own traces to ingest |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | | Where and how. Ignored unless the switch above is on |
| `OTEL_SERVICE_NAME` | soonwhy-api | Service name |
| `SOONWHY_TRACE_SAMPLE_RATIO` | 0.1 | Share of root traces kept |
| `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG` | | Standard OpenTelemetry sampler settings |

**Dashboard (build time)**

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | API the dashboard calls |
| `VITE_INGEST_URL` | `https://ingest-soonwhy.oktopals.com` | Ingest URL shown in setup snippets |

## Docs (local only)

Design notes, ADRs, and agent skills live on the filesystem only and are intentionally not published to GitHub. Only this `README.md` is tracked.
