# 06: Data Flow Diagram

**What to build:** A document showing the end-to-end data flow from SDK to dashboard.

**Blocked by:** 05 (needs service boundaries)

**Status:** done

- [x] Ingestion flow: SDK → API → NATS → Processor → ClickHouse
- [x] Query flow: Dashboard → API → ClickHouse → Response
- [x] Cold migration flow: ClickHouse → R2 + Parquet
- [x] AI flow: Dashboard → AI Worker → Evidence → LLM → Response
- [x] Notification flow: Alert → Notification Worker → Provider
- [x] Text-based diagrams for each flow

**Output:** `docs/architecture/data-flow.md`
