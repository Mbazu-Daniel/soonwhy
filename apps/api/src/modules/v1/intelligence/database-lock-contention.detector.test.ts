import { describe, expect, it } from "vitest";
import {
  detectDatabaseLockContention,
  type DatabaseLockTrace,
} from "./database-lock-contention.detector";

function trace(overrides: Partial<DatabaseLockTrace> = {}): DatabaseLockTrace {
  return {
    timestamp: "2026-09-20T18:00:00.000Z",
    service: "checkout-api",
    traceId: "trace-1",
    spanId: "span-1",
    duration: 400,
    dependencyType: "database",
    dependencyName: "postgres",
    dbQueryText: "select * from orders where id = ? for update",
    ...overrides,
  };
}

describe("detectDatabaseLockContention", () => {
  it("detects deadlock errors grouped by query fingerprint", () => {
    const samples = [
      trace({ statusMessage: "deadlock detected", errorType: "40P01" }),
      trace({ spanId: "span-2", statusMessage: "deadlock detected" }),
      trace({ spanId: "span-3" }),
      trace({ spanId: "span-4" }),
      trace({ spanId: "span-5" }),
    ];

    const [candidate] = detectDatabaseLockContention(samples);

    expect(candidate).toMatchObject({
      serviceName: "checkout-api",
      signal: {
        sampleCount: 5,
        lockErrorCount: 2,
        lockErrorRate: 0.4,
        contentionSignals: ["lock_error"],
        confidence: "high",
      },
    });
    expect(candidate?.identity.fingerprint).toEqual(expect.any(String));
    expect(candidate?.recommendation).toContain("transaction boundaries");
  });

  it("detects overlapping slow lock-acquiring queries without errors", () => {
    const samples = Array.from({ length: 6 }, (_, index) =>
      trace({
        spanId: "span-" + index,
        timestamp: `2026-09-20T18:00:00.${index}00Z`,
        duration: 400,
      }),
    );

    const [candidate] = detectDatabaseLockContention(samples);

    expect(candidate).toMatchObject({
      signal: {
        lockQueryCount: 6,
        lockQueryRate: 1,
        contentionSignals: ["lock_wait"],
        confidence: "medium",
      },
    });
    expect(candidate?.signal.overlappingPairCount).toBeGreaterThanOrEqual(2);
  });

  it("rejects slow lock-acquiring queries that never overlap", () => {
    const samples = Array.from({ length: 6 }, (_, index) =>
      trace({
        spanId: "span-" + index,
        timestamp: `2026-09-20T18:${String(index * 5).padStart(2, "0")}:00.000Z`,
        duration: 400,
      }),
    );

    expect(detectDatabaseLockContention(samples)).toEqual([]);
  });

  it("rejects non-lock errors and healthy lock queries", () => {
    expect(
      detectDatabaseLockContention([
        trace({ statusMessage: "connection refused" }),
      ]),
    ).toEqual([]);

    expect(
      detectDatabaseLockContention(
        Array.from({ length: 6 }, (_, index) =>
          trace({
            spanId: "span-" + index,
            timestamp: `2026-09-20T18:00:0${index}.000Z`,
            duration: 100,
          }),
        ),
      ),
    ).toEqual([]);
  });

  it("ignores non-database dependencies", () => {
    expect(
      detectDatabaseLockContention([
        trace({ dependencyType: "redis", statusMessage: "deadlock detected" }),
      ]),
    ).toEqual([]);
  });
});
