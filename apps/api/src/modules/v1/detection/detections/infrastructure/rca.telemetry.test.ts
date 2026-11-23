import { beforeEach, describe, expect, it, vi } from "vitest";

const recordTraceLoad = vi.hoisted(() => vi.fn());
vi.mock("../../../../../common/telemetry/otel-metrics", () => ({ recordRcaTraceLoad: recordTraceLoad }));

import { TraceRankingTelemetry } from "./rca.telemetry";

const span = (traceId: string) => ({ traceId, spanId: `${traceId}-s`, name: "op", duration: 10, timestamp: "2026-01-01T00:00:00.000Z", service: "api" });

const telemetryFor = (outcomes: Record<string, "spans" | "empty" | "fails">) =>
  new TraceRankingTelemetry({
    getTrace: vi.fn(async (_org: string, _project: string, id: string) => {
      if (outcomes[id] === "fails") throw new Error("quickwit timeout");
      return { spans: outcomes[id] === "empty" ? [] : [span(id)] } as never;
    }),
  });

describe("TraceRankingTelemetry.loadTraces", () => {
  beforeEach(() => recordTraceLoad.mockClear());

  it("returns every trace and no failures when all of them load", async () => {
    const load = await telemetryFor({ a: "spans", b: "spans" }).loadTraces("o", "p", ["a", "b"]);
    expect(load).toMatchObject({ requested: 2, failed: [], notFound: [] });
    expect(load.traces).toHaveLength(2);
  });

  it("names the traces that failed, apart from the ones that loaded", async () => {
    const load = await telemetryFor({ a: "spans", b: "fails", c: "spans" }).loadTraces("o", "p", ["a", "b", "c"]);
    expect(load.failed).toEqual(["b"]);
    expect(load.notFound).toEqual([]);
    expect(load.traces.map((spans) => spans[0]?.traceId)).toEqual(["a", "c"]);
    expect(load.requested).toBe(3);
  });

  it("counts a trace with no spans as not found, not as a failure", async () => {
    const load = await telemetryFor({ a: "empty", b: "spans" }).loadTraces("o", "p", ["a", "b"]);
    expect(load.notFound).toEqual(["a"]);
    expect(load.failed).toEqual([]);
    expect(load.traces).toHaveLength(1);
  });

  it("reports an all-not-found load without any traces", async () => {
    const load = await telemetryFor({ a: "empty", b: "empty" }).loadTraces("o", "p", ["a", "b"]);
    expect(load).toEqual({ traces: [], failed: [], notFound: ["a", "b"], requested: 2 });
  });

  it("counts loaded, failed and not found traces in a metric", async () => {
    await telemetryFor({ a: "spans", b: "fails", c: "empty" }).loadTraces("o", "p", ["a", "b", "c"]);
    expect(recordTraceLoad).toHaveBeenCalledWith({ loaded: 1, failed: 1, notFound: 1 });
  });
});
