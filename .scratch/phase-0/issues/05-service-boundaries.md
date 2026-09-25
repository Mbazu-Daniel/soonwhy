# 05: Service Boundaries

**What to build:** A document defining which services exist, what each does, and how they communicate.

**Blocked by:** None (can start immediately)

 **Status: done**

- [x] Service inventory:
  - API (NestJS) — REST endpoints, auth, tenant resolution
  - Ingestion Worker — receives telemetry from SDK, validates, publishes to NATS
  - Processor Worker — normalizes, aggregates, writes to ClickHouse
  - AI Worker — evidence extraction, LLM calls, confidence scoring
  - Scheduler — cron jobs, data migration, cleanup
  - Notifications — email, Slack, Discord, webhooks
- [x] Communication patterns (NATS JetStream topics)
- [x] Service responsibilities (what each service owns)
- [x] Service boundaries (what each service does NOT do)

**Output:** `docs/architecture/services.md`
