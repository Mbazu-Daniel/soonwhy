# Soonwhy — Domain Glossary

## Core Concepts

### Telemetry
Raw data emitted by applications. In Soonwhy, telemetry includes logs, metrics, traces, and API monitoring data.

### Ingestion
The process of receiving telemetry from SDKs and storing it for processing.

### Mission Control
The primary dashboard where developers see their application's health, telemetry, and AI insights.

### Health Score
A composite metric (0-100) representing overall application health, computed from latency, error rate, and throughput.

### Evidence
Specific telemetry data points that support an AI conclusion. Every AI response must cite evidence.

### Confidence Score
A value (0-1) representing how certain the AI is about its conclusion. Below 0.7, the AI says "I need more data."

## Entities

### Organization
Top-level tenant. Owns projects and billing.

### Project
A monitored application. Contains environments.

### Environment
A deployment target (production, staging, development).

### Service
A component within a project (e.g., "api", "worker", "scheduler").

### API Key
Credentials for SDK authentication. Scoped to a project + environment.

## Telemetry Signals

### Log
A discrete event with a message, timestamp, and structured attributes.

### Metric
A numeric time series (counter, gauge, histogram).

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
Linking events across signals (e.g., latency increase coincided with deployment).

### Hallucination Safeguard
Mechanism preventing the AI from making claims not backed by telemetry evidence.

## Infrastructure

### Hot Storage
Telemetry data in self-hosted ClickHouse (on Dokploy) for fast analytical queries (0-7 days).

### Cold Storage
Archived telemetry in R2 + Parquet for cost-efficient long-term retention (7+ days).

### Event Bus
NATS JetStream for async communication between API and workers.

### Parquet
Columnar file format for efficient analytical queries on archived telemetry.
