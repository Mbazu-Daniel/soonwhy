import { describe, it } from "vitest";
import { RcaService } from "../src/modules/v1/detection/detections/application/rca.service";
import { correlateFindings } from "../src/modules/v1/detection/detections/domain/detection.correlation";
import type { CorrelatedBottleneck } from "../src/modules/v1/detection/detections/domain/detection.correlation.types";
import type { DetectionFinding } from "../src/modules/v1/detection/detections/domain/detection.types";
import { TraceRankingTelemetry } from "../src/modules/v1/detection/detections/infrastructure/rca.telemetry";

const API = process.env.API ?? "http://localhost:3001/api/v1";
const { TOKEN, ORG, PID } = process.env;
const base = `${API}/organization/${ORG}/projects/${PID}`;
const get = async (path: string) => {
  const res = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
};

const provider = {
  analyze: async () => ({
    analysis: {
      summary: "Latency increased.", rootCause: "The root cause is not established from the supplied evidence.",
      contributingFactors: [], investigationSteps: [], suggestedChanges: [], evidenceRefs: [],
      confidence: "low", limitations: ["The exact cause is not established."],
    },
    usage: { requestDurationMs: 1, retries: 0 },
    promptVersion: "live-check",
  }),
};
const resolver = {
  resolveForRca: async () => ({ provider, credential: { source: "byok" as const, providerId: "stub", model: "stub", credentialId: "stub" }, promptVersion: "live-check" }),
  describe: async () => ({ source: "byok" as const, provider: "stub", model: "stub" }),
};

describe("live check: RCA ranking inputs from real telemetry", () => {
  it("ranks with traces, errors and the dependency map", async () => {
    const raw = (await get("/findings")) as Array<Record<string, any>>;
    const findings: DetectionFinding[] = raw.map((f) => ({
      id: f.id, projectId: f.projectId, serviceName: f.serviceName, type: f.type, severity: f.severity, title: f.title,
      description: f.description, observedValue: f.observedValue, threshold: f.threshold, unit: f.unit,
      window: { start: new Date(f.windowStart), end: new Date(f.windowEnd) }, evidence: f.evidence ?? [],
    }));
    const traces = (await get("/traces?limit=60&from=2000-01-01T00:00:00Z&to=2100-01-01T00:00:00Z")) as { data: Array<{ traceId: string; durationMs: number }> };
    const slow = traces.data.filter((t) => t.durationMs > 1000).slice(0, 15).map((t) => t.traceId);
    console.log(`findings=${findings.length} slowTraces=${slow.length}`);

    const latency = findings.find((f) => f.serviceName === "db" && f.type === "latency")!;
    const bottleneck: CorrelatedBottleneck =
      correlateFindings(findings).find((b) => b.serviceName === "db") ?? {
        serviceName: "db", latency, supportingFindings: findings.filter((f) => f.id !== latency.id && ["orders", "inventory", "gateway"].includes(f.serviceName) && f.type === "latency"),
        recommendation: "inspect", traceIds: slow,
      };
    bottleneck.traceIds = slow;

    const telemetry = new TraceRankingTelemetry({
      getTrace: async (_o: string, _p: string, id: string) => (await get(`/traces/${id}`)) as never,
    });
    const show = async (label: string, service: RcaService) => {
      const { evidence } = await service.analyze(ORG!, PID!, bottleneck);
      console.log(`\n== ${label} (overall evidence coverage ${evidence.evidenceCoverage})`);
      for (const c of evidence.rankedCandidates ?? []) {
        console.log(`${c.serviceName.padEnd(10)} score=${c.score.toFixed(3)} signals=${JSON.stringify(Object.fromEntries(Object.entries(c.signalScores).map(([k, v]) => [k, Number((v as number).toFixed(2))])))} callsInto=${JSON.stringify(c.dependencies.upstream)} calledBy=${JSON.stringify(c.dependencies.downstream)}`);
      }
      console.log("limitations:", JSON.stringify(evidence.rankingLimitations));
    };
    await show("findings only (before this change)", new RcaService(resolver as never));
    await show("with traces, errors and dependency map", new RcaService(resolver as never, telemetry));
  });
});
