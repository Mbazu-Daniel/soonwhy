# ADR-0005: Shared Database with Row-Level Security

## Status

Accepted

## Context

Soonwhy is multi-tenant. Different organizations must never see each other's telemetry data.

## Decision

Use shared PostgreSQL database with tenant_id columns and Row-Level Security (RLS):

- All tables include `org_id` column
- RLS policies enforce tenant isolation at database level
- Application middleware adds org_id filter to all queries
- RLS acts as safety net even if application bug misses filter

## Consequences

### Positive
- Simple schema management
- Single database to operate
- Strong isolation via RLS
- Easy backups and migrations

### Negative
- All orgs share compute resources
- Noisy neighbor risk
- Schema changes affect all tenants

### Mitigation
- Monitor query performance per tenant
- Implement connection pooling with tenant awareness
- Consider schema-per-tenant for enterprise customers later

## Alternatives Considered
- **Schema per tenant**: Stronger isolation, but complex migrations
- **Database per tenant**: Maximum isolation, but highest operational cost
- **No RLS**: Simpler, but risky if application has bugs
