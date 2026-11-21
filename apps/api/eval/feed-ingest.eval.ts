import { afterAll, beforeAll, describe, it } from "vitest";
import { Cluster, openLoop } from "./cluster";
import type { SpanRecord } from "./types";

const INGEST_URL = process.env.INGEST_URL ?? "http://localhost:3002";
const INGEST_KEY = process.env.INGEST_KEY ?? "";
const BASELINE_S = Number(process.env.FEED_BASELINE_S ?? 120);
const FAULT_S = Number(process.env.FEED_FAULT_S ?? 120);
const RPS = Number(process.env.FEED_RPS ?? 8);

const nano = (ms: number) => String(BigInt(Math.round(ms * 1e6)) + 0n);

let offsetMs = 0;

function toOtlp(spans: SpanRecord[]) {
  const byService = new Map<string, SpanRecord[]>();
  for (const s of spans) (byService.get(s.service) ?? byService.set(s.service, []).get(s.service)!).push(s);
  return {
    resourceSpans: [...byService].map(([service, list]) => ({
      resource: { attributes: [{ key: "service.name", value: { stringValue: service } }] },
      scopeSpans: [
        {
          scope: { name: "eval-sample-app" },
          spans: list.map((s) => ({
            traceId: s.traceId,
            spanId: s.spanId,
            ...(s.parentSpanId ? { parentSpanId: s.parentSpanId } : {}),
            name: s.name,
            kind: s.kind === "server" ? 2 : 3,
            startTimeUnixNano: nano(s.start + offsetMs),
            endTimeUnixNano: nano(s.end + offsetMs),
            attributes: s.peer
              ? [{ key: "peer.service", value: { stringValue: s.peer } }]
              : [
                  { key: "http.request.method", value: { stringValue: "GET" } },
                  { key: "http.route", value: { stringValue: `/${s.service}` } },
                  { key: "url.path", value: { stringValue: `/${s.service}` } },
                  { key: "http.response.status_code", value: { intValue: s.error ? 500 : 200 } },
                ],
            status: { code: s.error ? 2 : 1 },
          })),
        },
      ],
    })),
  };
}

describe("feed sample-app traces into the ingest endpoint", () => {
  const cluster = new Cluster();
  let buffer: SpanRecord[] = [];
  let sent = 0;
  let failed = 0;
  let timer: ReturnType<typeof setInterval>;

  beforeAll(async () => {
    cluster.onSpan = (span) => buffer.push(span);
    await cluster.start();
    timer = setInterval(async () => {
      if (buffer.length === 0) return;
      const batch = buffer;
      buffer = [];
      try {
        const res = await fetch(`${INGEST_URL}/v1/traces`, {
          method: "POST",
          headers: { authorization: `Bearer ${INGEST_KEY}`, "content-type": "application/json" },
          body: JSON.stringify(toOtlp(batch)),
        });
        if (res.ok) sent += batch.length;
        else failed += batch.length;
      } catch {
        failed += batch.length;
      }
    }, 1000);
  });
  afterAll(() => {
    clearInterval(timer);
    cluster.stop();
  });

  it("sends a baseline period then a database fault", async () => {
    offsetMs = -22 * 60_000;
    await cluster.reset(11);
    await openLoop(RPS, BASELINE_S);
    await new Promise((r) => setTimeout(r, 2000));
    console.log(`baseline done sent=${sent} failed=${failed}`);
    offsetMs = -8 * 60_000;
    await cluster.setFault("db", { delayMs: 450 });
    await openLoop(RPS, FAULT_S);
    await cluster.reset(11);
    await new Promise((r) => setTimeout(r, 3000));
    console.log(`fault done sent=${sent} failed=${failed}`);
  });
});
