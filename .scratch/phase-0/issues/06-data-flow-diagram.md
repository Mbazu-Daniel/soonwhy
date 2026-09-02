# 06: Data Flow Diagram

**What to build:** A document showing the end-to-end data flow from SDK to dashboard.

**Blocked by:** 05 (needs service boundaries)

**Status:** ready-for-agent

- [ ] Ingestion flow: SDK → API → NATS → Processor → ClickHouse
- [ ] Query flow: Dashboard → API → ClickHouse → Response
- [ ] Cold migration flow: ClickHouse → R2 + Parquet
- [ ] AI flow: Dashboard → AI Worker → Evidence → LLM → Response
- [ ] Notification flow: Alert → Notification Worker → Provider
- [ ] Text-based diagrams for each flow

**Output:** `docs/architecture/data-flow.md`
