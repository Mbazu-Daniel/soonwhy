import { describe, expect, it } from "vitest";
import {
  detectAgentLoops,
  detectCostSpike,
  detectLatencyRegression,
  detectModelFailure,
  detectProviderFailure,
  detectRateLimitHits,
  detectRetrievalFailures,
  detectRetryLoops,
  detectTokenSpike,
  detectToolCallFailures,
} from "./ai-detector";
import type { AIOperation } from "./ai-intelligence.types";

function operation(overrides: Partial<AIOperation> = {}): AIOperation {
  return {
    id: "op-1",
    timestamp: "2026-05-01T00:00:00.000Z",
    provider: "openai",
    model: "gpt-4",
    operationType: "chat",
    latencyMs: 100,
    serviceName: "assistant",
    ...overrides,
  };
}

describe("detectTokenSpike", () => {
  it("flags token usage above the baseline threshold", () => {
    const operations = [
      operation({ timestamp: "2026-05-01T00:00:00.000Z", totalTokens: 3000 }),
      operation({ timestamp: "2026-05-01T00:01:00.000Z", totalTokens: 3000 }),
    ];

    const [finding] = detectTokenSpike(operations, 1000, 2);

    expect(finding).toMatchObject({ severity: "critical", currentTokensPerMinute: 6000 });
  });

  it("returns nothing within the threshold or without operations", () => {
    expect(detectTokenSpike([operation({ totalTokens: 100 })], 1000, 2)).toEqual([]);
    expect(detectTokenSpike([], 1000, 2)).toEqual([]);
  });
});

describe("detectCostSpike", () => {
  it("flags spend growth per hour", () => {
    const operations = [
      operation({ timestamp: "2026-05-01T00:00:00.000Z", costUsd: 0.5 }),
      operation({ timestamp: "2026-05-01T00:01:00.000Z", costUsd: 0.5 }),
    ];

    const [finding] = detectCostSpike(operations, 10, 2);

    expect(finding?.currentCostPerHour).toBeCloseTo(60);
    expect(finding?.severity).toBe("critical");
  });

  it("returns nothing for stable spend", () => {
    expect(detectCostSpike([operation({ costUsd: 0.01 })], 100, 2)).toEqual([]);
  });
});

describe("detectLatencyRegression", () => {
  it("flags average latency growth", () => {
    const operations = [operation({ latencyMs: 600 }), operation({ latencyMs: 400 })];

    const [finding] = detectLatencyRegression(operations, 200, 0.5);

    expect(finding).toMatchObject({ currentLatencyMs: 500, severity: "critical" });
  });

  it("returns nothing for acceptable latency", () => {
    expect(detectLatencyRegression([operation({ latencyMs: 220 })], 200, 0.5)).toEqual([]);
  });
});

describe("detectProviderFailure", () => {
  it("reports providers above the error rate threshold", () => {
    const operations = [
      operation({ error: "500" }),
      operation({ error: "timeout" }),
      operation(),
      operation({ provider: "anthropic" }),
      operation({ provider: "anthropic" }),
    ];

    const [finding] = detectProviderFailure(operations, 0.1);

    expect(finding).toMatchObject({ provider: "openai", errorCount: 2 });
    expect(finding?.errorRate).toBeCloseTo(2 / 3);
    expect(finding?.severity).toBe("critical");
  });

  it("ignores healthy providers", () => {
    expect(detectProviderFailure([operation(), operation()], 0.1)).toEqual([]);
  });
});

describe("detectModelFailure", () => {
  it("reports failing models with their provider", () => {
    const operations = [
      operation({ error: "500" }),
      operation({ error: "timeout" }),
      operation(),
      operation(),
    ];

    const [finding] = detectModelFailure(operations, 0.1);

    expect(finding).toMatchObject({ provider: "openai", model: "gpt-4", errorRate: 0.5 });
  });
});

describe("detectRateLimitHits", () => {
  it("detects rate limit errors", () => {
    const operations = [
      operation({ error: "429 Too Many Requests" }),
      operation({ error: "rate limit exceeded" }),
      operation(),
    ];

    const [finding] = detectRateLimitHits(operations);

    expect(finding).toMatchObject({ rateLimitHits: 2, severity: "warning" });
  });

  it("returns nothing without rate limit errors", () => {
    expect(detectRateLimitHits([operation()])).toEqual([]);
  });
});

describe("detectRetryLoops", () => {
  it("flags operation ids retried beyond the limit", () => {
    const operations = Array.from({ length: 4 }, (_, index) =>
      operation({ id: "retry-1", latencyMs: 100, timestamp: `2026-05-01T00:00:0${index}.000Z` }),
    );

    const [finding] = detectRetryLoops(operations, 3);

    expect(finding).toMatchObject({ operationId: "retry-1", retryCount: 4, severity: "warning" });
  });

  it("ignores operations within the retry limit", () => {
    expect(
      detectRetryLoops([
        operation({ id: "retry-1" }),
        operation({ id: "retry-1" }),
      ]),
    ).toEqual([]);
  });
});

describe("detectToolCallFailures", () => {
  it("groups failures by tool name", () => {
    const operations = [
      operation({ operationType: "tool_call", metadata: { toolName: "search" }, error: "failed" }),
      operation({ operationType: "tool_call", metadata: { toolName: "search" } }),
      operation({ operationType: "tool_call", metadata: { toolName: "search" } }),
      operation({ operationType: "tool_call", metadata: { toolName: "search" } }),
    ];

    const [finding] = detectToolCallFailures(operations, 0.2);

    expect(finding).toMatchObject({ toolName: "search", errorCount: 1, errorRate: 0.25 });
    expect(finding?.severity).toBe("warning");
  });

  it("ignores non tool operations", () => {
    expect(detectToolCallFailures([operation({ error: "failed" })])).toEqual([]);
  });
});

describe("detectAgentLoops", () => {
  it("flags excessive agent steps within a trace", () => {
    const operations = Array.from({ length: 11 }, (_, index) =>
      operation({ id: `step-${index}`, operationType: "agent_step", traceId: "trace-1" }),
    );

    const [finding] = detectAgentLoops(operations, 10);

    expect(finding).toMatchObject({ loopType: "excessive", stepCount: 11, severity: "warning" });
  });

  it("escalates very long agent traces", () => {
    const operations = Array.from({ length: 21 }, (_, index) =>
      operation({ id: `step-${index}`, operationType: "agent_step", traceId: "trace-1" }),
    );

    expect(detectAgentLoops(operations, 10)[0]).toMatchObject({
      loopType: "infinite",
      severity: "critical",
    });
  });

  it("ignores traces below the step limit", () => {
    expect(
      detectAgentLoops([operation({ operationType: "agent_step", traceId: "trace-1" })], 10),
    ).toEqual([]);
  });
});

describe("detectRetrievalFailures", () => {
  it("reports retrieval sources above the error threshold", () => {
    const operations = [
      operation({ operationType: "retrieval", metadata: { source: "vector-db", resultsCount: 10 } }),
      operation({ operationType: "retrieval", metadata: { source: "vector-db", resultsCount: 0 }, error: "timeout" }),
      operation({ operationType: "retrieval", metadata: { source: "vector-db", resultsCount: 8 } }),
      operation({ operationType: "retrieval", metadata: { source: "vector-db", resultsCount: 6 } }),
    ];

    const [finding] = detectRetrievalFailures(operations, 0.15);

    expect(finding).toMatchObject({ source: "vector-db", errorCount: 1, errorRate: 0.25 });
    expect(finding?.severity).toBe("warning");
  });

  it("ignores healthy retrieval sources", () => {
    expect(
      detectRetrievalFailures([
        operation({ operationType: "retrieval", metadata: { source: "vector-db" } }),
      ]),
    ).toEqual([]);
  });
});
