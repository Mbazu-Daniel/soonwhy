import { describe, expect, it } from "vitest";
import type { RcaEvidence } from "./rca.types";
import { validateRcaAnalysis } from "./rca.validation";

const evidence: RcaEvidence = {
  projectId: "project_123",
  serviceName: "checkout-api",
  severity: "critical",
  window: {
    start: new Date("2026-09-22T00:00:00.000Z"),
    end: new Date("2026-09-22T00:15:00.000Z"),
  },
  primaryFinding: {
    id: "finding_latency:0",
    sourceFindingId: "finding_latency",
    type: "latency",
    severity: "critical",
    label: "primary-latency",
    value: 1600,
  },
  supportingFindings: [
    {
      id: "finding_dependency:0",
      sourceFindingId: "finding_dependency",
      type: "dependency_latency",
      severity: "critical",
      label: "dependency-latency",
      value: 900,
    },
  ],
  traces: [],
  recommendations: [],
};

describe("validateRcaAnalysis", () => {
  it("accepts a valid grounded analysis", () => {
    expect(
      validateRcaAnalysis(
        {
          summary: "Checkout latency increased.",
          rootCause:
            "The available evidence points to the database dependency.",
          contributingFactors: ["Database latency increased."],
          investigationSteps: ["Inspect the database query plan."],
          suggestedChanges: ["Candidate: review the query and indexes."],
          evidenceRefs: ["finding_latency:0", "finding_dependency:0"],
          confidence: "medium",
          limitations: [
            "The evidence does not establish the exact query plan.",
          ],
        },
        evidence,
      ),
    ).toMatchObject({ confidence: "medium" });
  });

  it("rejects malformed analysis", () => {
    expect(() =>
      validateRcaAnalysis(
        {
          summary: "missing required fields",
          confidence: "certain",
        },
        evidence,
      ),
    ).toThrow();
  });

  it("drops evidence references that were not supplied and says so", () => {
    const result = validateRcaAnalysis(
      {
        summary: "Checkout latency increased.",
        rootCause: "Unknown.",
        contributingFactors: [],
        investigationSteps: [],
        suggestedChanges: [],
        evidenceRefs: ["invented:0", "finding_latency:0"],
        confidence: "low",
        limitations: ["Insufficient evidence."],
      },
      evidence,
    );

    expect(result.evidenceRefs).toEqual(["finding_latency:0"]);
    expect(result.limitations).toEqual([
      "Insufficient evidence.",
      "One evidence reference from the model did not match the supplied evidence and was removed.",
    ]);
  });

  it("accepts the bare id of a supplied finding", () => {
    const result = validateRcaAnalysis(
      {
        summary: "Checkout latency increased.",
        rootCause: "The dependency slowed down.",
        contributingFactors: [],
        investigationSteps: [],
        suggestedChanges: [],
        evidenceRefs: ["finding_latency", "finding_dependency:0"],
        confidence: "low",
        limitations: ["Insufficient evidence."],
      },
      evidence,
    );

    expect(result.evidenceRefs).toEqual(["finding_latency", "finding_dependency:0"]);
  });

  it("drops a bare id that belongs to no supplied finding", () => {
    const result = validateRcaAnalysis(
      {
        summary: "Checkout latency increased.",
        rootCause: "Unknown.",
        contributingFactors: [],
        investigationSteps: [],
        suggestedChanges: [],
        evidenceRefs: ["finding_other"],
        confidence: "low",
        limitations: ["Insufficient evidence."],
      },
      evidence,
    );

    expect(result.evidenceRefs).toEqual([]);
  });

  it("accepts a trace id that appears in the supplied evidence", () => {
    const withTrace: RcaEvidence = {
      ...evidence,
      traces: [
        {
          id: "finding_latency:2",
          sourceFindingId: "finding_latency",
          type: "latency",
          severity: "critical",
          label: "latest-trace",
          value: "6cf333b1bd098c4490c988821766d079",
          context: { traceId: "feedfacefeedfacefeedfacefeedface" },
        },
      ],
    };
    const analysis = {
      summary: "Checkout latency increased.",
      rootCause: "The dependency slowed down.",
      contributingFactors: [],
      investigationSteps: [],
      suggestedChanges: [],
      confidence: "low",
      limitations: ["Insufficient evidence."],
    };

    expect(
      validateRcaAnalysis({ ...analysis, evidenceRefs: ["6cf333b1bd098c4490c988821766d079"] }, withTrace).evidenceRefs,
    ).toEqual(["6cf333b1bd098c4490c988821766d079"]);
    expect(
      validateRcaAnalysis({ ...analysis, evidenceRefs: ["feedfacefeedfacefeedfacefeedface"] }, withTrace).evidenceRefs,
    ).toEqual(["feedfacefeedfacefeedfacefeedface"]);
    expect(
      validateRcaAnalysis({ ...analysis, evidenceRefs: ["0123456789abcdef0123456789abcdef"] }, withTrace).evidenceRefs,
    ).toEqual([]);
  });

  it("keeps the note within the limitation cap", () => {
    const full = Array.from({ length: 10 }, (_, index) => `Limit ${index}`);

    const result = validateRcaAnalysis(
      {
        summary: "Checkout latency increased.",
        rootCause: "The dependency slowed down.",
        contributingFactors: [],
        investigationSteps: [],
        suggestedChanges: [],
        evidenceRefs: ["a", "b"],
        confidence: "low",
        limitations: full,
      },
      evidence,
    );

    expect(result.limitations).toHaveLength(3);
    expect(result.limitations[2]).toContain("2 evidence references");
  });

  describe("when the ranker's top candidate has low confidence", () => {
    const analysis = (confidence: "high" | "medium" | "low") => ({
      summary: "Checkout latency increased.",
      rootCause: "The available evidence points to the database dependency.",
      contributingFactors: ["Database latency increased."],
      investigationSteps: ["Inspect the database query plan."],
      suggestedChanges: ["Candidate: review the query and indexes."],
      evidenceRefs: ["finding_latency:0", "finding_dependency:0"],
      confidence,
      limitations: ["The evidence does not establish the exact query plan."],
    });

    it("does not let the analysis claim high confidence, and says why", () => {
      const result = validateRcaAnalysis(analysis("high"), { ...evidence, rankingConfidence: "low" });
      expect(result.confidence).toBe("medium");
      expect(result.limitations).toContain("The ranked candidates have low confidence, so the suspect is not presented as established.");
    });

    it("leaves a medium or low analysis alone", () => {
      expect(validateRcaAnalysis(analysis("medium"), { ...evidence, rankingConfidence: "low" }).limitations).toHaveLength(1);
      expect(validateRcaAnalysis(analysis("low"), { ...evidence, rankingConfidence: "low" }).confidence).toBe("low");
    });

    it("leaves a high analysis alone when the ranking is medium or high or absent", () => {
      expect(validateRcaAnalysis(analysis("high"), { ...evidence, rankingConfidence: "high" }).confidence).toBe("high");
      expect(validateRcaAnalysis(analysis("high"), { ...evidence, rankingConfidence: "medium" }).confidence).toBe("high");
      expect(validateRcaAnalysis(analysis("high"), evidence).confidence).toBe("high");
    });
  });
});

describe("validateRcaAnalysis length limits", () => {
  const base = {
    summary: "Checkout latency rose because the payments call slowed.",
    rootCause: "The payments dependency is slow.",
    contributingFactors: [],
    investigationSteps: [],
    suggestedChanges: [],
    evidenceRefs: ["finding_latency:0"],
    confidence: "medium" as const,
    limitations: [],
  };

  it("keeps only the first few items of each list, which are the most important", () => {
    const items = ["one", "two", "three", "four", "five", "six"];
    const result = validateRcaAnalysis({ ...base, contributingFactors: items, investigationSteps: items, suggestedChanges: items }, evidence);

    expect(result.contributingFactors).toEqual(["one", "two", "three"]);
    expect(result.investigationSteps).toEqual(["one", "two", "three"]);
    expect(result.suggestedChanges).toEqual(["one", "two", "three"]);
  });

  it("keeps at most three limitations, so missing inputs are not listed one by one", () => {
    const limitations = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    expect(validateRcaAnalysis({ ...base, limitations }, evidence).limitations).toEqual(["a", "b", "c"]);
  });

  it("shortens an over-long answer at a sentence end instead of rejecting it", () => {
    const sentence = "The payments call is slow because of connection pool exhaustion. ";
    const result = validateRcaAnalysis({ ...base, summary: sentence.repeat(20) }, evidence);

    expect(result.summary.length).toBeLessThanOrEqual(400);
    expect(result.summary.endsWith(".")).toBe(true);
  });

  it("leaves short answers unchanged", () => {
    expect(validateRcaAnalysis(base, evidence).summary).toBe(base.summary);
  });
});
