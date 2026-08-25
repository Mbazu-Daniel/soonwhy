# ADR-0001: Use NestJS + Drizzle ORM Instead of Go + Gin

## Status

Accepted

## Context

The original plan specified Go + Gin for the backend. However, the team has stronger TypeScript expertise and the frontend is already TypeScript (TanStack Start).

## Decision

Use NestJS + Drizzle ORM for the backend instead of Go + Gin.

## Consequences

### Positive
- Single language (TypeScript) across entire stack
- Shared types between frontend and backend
- Faster development velocity
- NestJS provides excellent DI, websockets, and API patterns
- Drizzle ORM is type-safe and lightweight

### Negative
- Go would provide better performance for high-throughput ingestion
- Go has lower memory footprint
- May need to rewrite ingestion hot path in Go later at scale

### Mitigation
- Monitor ingestion performance metrics
- If ingestion becomes bottleneck, rewrite ingestion worker in Go as a separate service
- NestJS can handle MVP traffic volumes

## Alternatives Considered
- **Go + Gin**: Better performance, but slower development velocity
- **Express/Fastify**: Simpler, but NestJS provides better patterns for large applications
