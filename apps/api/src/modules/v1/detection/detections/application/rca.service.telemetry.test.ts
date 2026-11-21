import { describe, expect, it, vi } from "vitest";
import type { CorrelatedBottleneck } from "../domain/detection.correlation.types";
import type { SpanRecord } from "../root-cause/root-cause.inputs.types";
import { RcaService } from "./rca.service";
import type { RcaModelResolver } from "./rca.service.types";

const provider = {
  analyze: vi.fn().mockResolvedValue({
    analysis: {
      summary: "Latency increased.", rootCause: "The root cause is not established from the supplied evidence.", contributingFactors: [], investigationSteps: [], suggestedChanges: [],
      evidenceRefs: [], confidence: "low", limitations: ["The exact cause is not established."],
    },
    usage: { requestDurationMs: 1, retries: 0 },
    promptVersion: "v2",
  }),
};

const resolver: RcaModelResolver = {
  resolveForRca: async () => ({
    provider,
    credential: { source: "byok" as const, providerId: "groq", model: "m", credentialId: "c" },
    promptVersion: "v2",
  }),
  describe: async () => ({ source: "byok" as const, provider: "groq", model: "m" }),
};

const window = { start: new Date("2026-09-22T00:00:00.000Z"), end: new Date("2026-09-22T00:15:00.000Z") };
const finding = (id: string, serviceName: string, observedValue: number) => ({
  id, projectId: "p", serviceName, type: "latency" as const, severity: "critical" as const, title: "t", description: "d",
  observedValue, baselineValue: 100, threshold: 500, unit: "ms" as const, window, evidence: [],
});

const bottleneck = (traceIds: string[]): CorrelatedBottleneck => ({
  serviceName: "api",
  latency: finding("f1", "api", 1200),
  supportingFindings: [finding("f2", "db", 900)],
  recommendation: "r",
  traceIds,
});

const spans: SpanRecord[] = [
  { traceId: "t1", spanId: "a", parentSpanId: "", name: "api", duration: 1000, timestamp: "2026-09-22T00:05:00.000Z", service: "api" },
  { traceId: "t1", spanId: "d", parentSpanId: "a", name: "db", duration: 900, timestamp: "2026-09-22T00:05:00.050Z", service: "db", statusCode: 2 },
];

const coverageOf = async (service: RcaService, traceIds: string[]) => {
  const result = await service.analyze("o", "p", bottleneck(traceIds));
  return result.evidence;
};

describe("RcaService ranking inputs", () => {
  it("passes traces, errors and the dependency map to the ranker", async () => {
    const telemetry = { loadTraces: vi.fn().mockResolvedValue([spans]) };
    const evidence = await coverageOf(new RcaService(resolver, telemetry), ["t1"]);

    expect(telemetry.loadTraces).toHaveBeenCalledWith("o", "p", ["t1"]);
    const db = evidence.rankedCandidates?.find((c) => c.serviceName === "db");
    expect(db?.signalScores).toHaveProperty("criticalPathContribution");
    expect(db?.signalScores).toHaveProperty("errorPropagation");
    expect(db?.signalScores).toHaveProperty("graphPosition");
    expect(evidence.evidenceCoverage).toBe(1);
  });

  it("ranks on findings alone when there are no representative traces", async () => {
    const telemetry = { loadTraces: vi.fn() };
    const evidence = await coverageOf(new RcaService(resolver, telemetry), []);
    expect(telemetry.loadTraces).not.toHaveBeenCalled();
    expect(evidence.evidenceCoverage).toBeLessThan(1);
  });

  it("falls back to findings alone when the telemetry lookup fails", async () => {
    const telemetry = { loadTraces: vi.fn().mockRejectedValue(new Error("quickwit down")) };
    const evidence = await coverageOf(new RcaService(resolver, telemetry), ["t1"]);
    expect(evidence.evidenceCoverage).toBeLessThan(1);
  });
});
