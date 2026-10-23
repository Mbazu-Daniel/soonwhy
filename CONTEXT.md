# Soonwhy — Domain Glossary

## Core Concepts

### Telemetry
Raw data emitted by applications. In Soonwhy, telemetry includes logs, metrics, traces, and API monitoring data.

### Ingestion
The process of receiving telemetry from OpenTelemetry-compatible sources and indexing it for processing.

### Mission Control
The primary dashboard where developers see their application's health, telemetry, and AI insights.

### Health Score
A composite metric representing application health, computed from latency, error rate, throughput, and other verified signals.

### Evidence
Specific telemetry data points that support an AI conclusion. Every AI response must cite evidence.

### Confidence Score
A value representing how strongly the available evidence supports a conclusion. Low-confidence conclusions ask for more data instead of presenting a guess as fact.

## Entities

### Organization
Top-level tenant. Owns projects and billing.

### Project
A monitored application owned by an organization. Deployment and environment are telemetry metadata rather than separate CRUD entities.

### Service
A component within a project such as an API, worker, or scheduler.

### API Key
Credentials for telemetry ingestion. Scoped to a project and therefore indirectly to its organization.

## Telemetry Signals

### Log
A discrete event with a message, timestamp, and structured attributes.

### Metric
A numeric time series such as a counter, gauge, or histogram.

### Trace
A distributed request lifecycle composed of spans.

### Span
A single unit of work within a trace.

### Request
An HTTP request/response pair with latency, status code, and endpoint.

## AI Concepts

### Root Cause Analysis
The process of identifying why an anomaly occurred, backed by correlated evidence.

### Anomaly Detection
Automatic identification of unusual patterns in telemetry data.

### Correlation
Linking events across signals, such as latency increases coinciding with a deployment or database regression.

### Hallucination Safeguard
Mechanisms preventing AI from making claims that are not backed by telemetry evidence.

## Infrastructure

### Search and Indexing
Quickwit is the primary telemetry search and indexing layer.

### Object Storage
Cloudflare R2 or another S3-compatible object store holds durable Quickwit index data.

### Event Bus
NATS JetStream provides the durable asynchronous ingestion boundary.

### SaaS Database
Postgres is the source of truth for organizations, projects, members, billing, API keys, and derived intelligence state.

## Intelligence Direction

Soonwhy is not limited to one performance pattern. N+1 is one example of a broader intelligence system covering request latency, database behavior, external dependencies, errors, CPU/runtime signals, traces, logs, and other observable failure modes.

The intelligence pipeline is evidence-first:

`stable identity -> repeated evidence -> measurable impact -> issue -> recommendation -> verification`
