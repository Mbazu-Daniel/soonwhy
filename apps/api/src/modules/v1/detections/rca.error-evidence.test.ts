import { describe, expect, it } from "vitest";
import { buildErrorRcaEvidence } from "./rca.error-evidence";
import { validateRcaAnalysis } from "./rca.validation";
import { buildRcaPrompt } from "./rca.prompt";

function finding(evidence: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    id: "finding_9",
    type: "error_group",
    projectId: "project_1",
    serviceName: "orders-api",
    severity: "critical",
    title: "TypeError in orders-api: cannot read properties of undefined",
    description: "42 occurrences",
    observedValue: 42,
    threshold: 1,
    unit: "occurrences",
    windowStart: new Date("2026-11-14T10:00:00Z"),
    windowEnd: new Date("2026-11-14T10:30:00Z"),
    evidence,
    ...overrides,
  } as never;
}

const WITH_STACK = [
  { kind: "metric", label: "Occurrences", value: 42, context: { traceCount: 7, firstSeen: "a", lastSeen: "b" } },
  { kind: "log", label: "Latest occurrence", value: "Cannot read properties of undefined (reading 'id')", context: { traceId: "t1" } },
  { kind: "trace", label: "Trace of the latest occurrence", value: "t1", context: { spanId: "s1" } },
  { kind: "log", label: "Stack trace", value: "TypeError: x\n    at OrdersService.create (/app/src/orders.service.ts:42:11)" },
  { kind: "log", label: "Application frames", value: "at OrdersService.create (/app/src/orders.service.ts:42:11)", context: { exception: "TypeError: x" } },
  { kind: "log", label: "Cause 1", value: "Error: connection refused", context: { topFrame: "at Pool.acquire (/app/src/db/pool.ts:8:2)" } },
];

describe("buildErrorRcaEvidence", () => {
  it("turns an error finding into evidence with frames, causes and the trace", () => {
    const evidence = buildErrorRcaEvidence(finding(WITH_STACK))!;
    expect(evidence.primaryFinding).toMatchObject({ id: "finding_9:0", type: "error_group", label: "error-group", value: 42 });
    expect(evidence.supportingFindings.map((entry) => entry.label)).toEqual(["stack-trace", "application-frames", "cause"]);
    expect(evidence.traces.map((entry) => entry.label)).toEqual(["latest-trace"]);
    const ids = [evidence.primaryFinding, ...evidence.supportingFindings, ...evidence.traces].map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns null for findings that are not error groups", () => {
    expect(buildErrorRcaEvidence(finding(WITH_STACK, { type: "latency" }))).toBeNull();
  });

  it("accepts an analysis that cites the frames", () => {
    const evidence = buildErrorRcaEvidence(finding(WITH_STACK))!;
    const frames = evidence.supportingFindings.find((entry) => entry.label === "application-frames")!;
    const analysis = {
      summary: "orders.service throws on undefined.",
      rootCause: "OrdersService.create reads id of an undefined value.",
      contributingFactors: [],
      investigationSteps: ["Check the caller of create."],
      suggestedChanges: ["Review the null handling in create."],
      evidenceRefs: [frames.id],
      confidence: "medium" as const,
      limitations: [],
    };
    expect(validateRcaAnalysis(analysis, evidence).evidenceRefs).toEqual([frames.id]);
  });

  it("forces 'not established' when there is no stack and no trace", () => {
    const evidence = buildErrorRcaEvidence(finding([WITH_STACK[0], WITH_STACK[1]]))!;
    expect(evidence.supportingFindings).toHaveLength(0);
    const overconfident = {
      summary: "s", rootCause: "The database is down.", contributingFactors: [], investigationSteps: [],
      suggestedChanges: ["Review it."], evidenceRefs: [], confidence: "medium" as const, limitations: [],
    };
    expect(() => validateRcaAnalysis(overconfident, evidence)).toThrow(/not established/);
    expect(validateRcaAnalysis({ ...overconfident, rootCause: "Root cause not established: no stack trace was captured." }, evidence).confidence).toBe("medium");
  });
});

describe("long stack evidence", () => {
  it("keeps more than 500 characters of application frames", () => {
    const frames = Array.from({ length: 20 }, (_, i) => `at Svc${i}.run (/app/src/svc-${i}.ts:${i}:1)`).join("\n");
    const evidence = buildErrorRcaEvidence(finding([{ kind: "log", label: "Application frames", value: frames }]))!;
    const kept = String(evidence.supportingFindings[0]!.value);
    expect(frames.length).toBeGreaterThan(500);
    expect(kept).toBe(frames);
  });

  it("still clips other long values at the default limit", () => {
    const evidence = buildErrorRcaEvidence(finding([{ kind: "log", label: "Cause 1", value: "x".repeat(900) }]))!;
    expect(String(evidence.supportingFindings[0]!.value).length).toBeLessThanOrEqual(501);
  });
});

describe("error group prompt", () => {
  it("adds error guidance only for error evidence", () => {
    const errorPrompt = buildRcaPrompt(buildErrorRcaEvidence(finding(WITH_STACK))!);
    expect(errorPrompt).toContain("application error group");
    expect(errorPrompt).toContain("application-frames");
    const bottleneck = { ...buildErrorRcaEvidence(finding(WITH_STACK))!, primaryFinding: { ...buildErrorRcaEvidence(finding(WITH_STACK))!.primaryFinding, type: "latency" as const } };
    expect(buildRcaPrompt(bottleneck)).not.toContain("application error group");
  });
});
