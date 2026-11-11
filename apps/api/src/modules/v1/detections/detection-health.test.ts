import { describe, expect, it } from "vitest";
import {
  summarizeDetectionRuns,
  type DetectionRunHealthRow,
} from "./detection-health";

const NOW = new Date("2026-11-05T12:00:00.000Z");

function run(overrides: Partial<DetectionRunHealthRow> = {}): DetectionRunHealthRow {
  return {
    id: `run_${Math.random().toString(36).slice(2, 8)}`,
    projectId: "project_1",
    status: "completed",
    startedAt: new Date("2026-11-05T11:00:00.000Z"),
    completedAt: new Date("2026-11-05T11:00:02.000Z"),
    findingsCount: 1,
    error: null,
    ...overrides,
  };
}

describe("summarizeDetectionRuns", () => {
  it("reports zeros and nulls for an empty window", () => {
    const summary = summarizeDetectionRuns([], NOW);

    expect(summary.totals).toEqual({
      runs: 0,
      completed: 0,
      failed: 0,
      running: 0,
      queued: 0,
      findings: 0,
      successRate: null,
      avgDurationMs: null,
      maxDurationMs: null,
    });
    expect(summary.lastRun).toBeNull();
    expect(summary.recent).toEqual([]);
    expect(summary.window.from).toBe("2026-11-04T12:00:00.000Z");
    expect(summary.window.to).toBe("2026-11-05T12:00:00.000Z");
  });

  it("computes success rate over finished runs only", () => {
    const summary = summarizeDetectionRuns(
      [
        run({ status: "completed" }),
        run({ status: "completed" }),
        run({ status: "completed" }),
        run({ status: "failed", completedAt: new Date("2026-11-05T11:00:01.000Z") }),
        run({ status: "running", completedAt: null }),
      ],
      NOW,
    );

    expect(summary.totals.runs).toBe(5);
    expect(summary.totals.completed).toBe(3);
    expect(summary.totals.failed).toBe(1);
    expect(summary.totals.running).toBe(1);
    expect(summary.totals.successRate).toBeCloseTo(0.75);
  });

  it("averages duration only over runs that finished", () => {
    const summary = summarizeDetectionRuns(
      [
        run({
          status: "completed",
          startedAt: new Date("2026-11-05T11:00:00.000Z"),
          completedAt: new Date("2026-11-05T11:00:04.000Z"),
          findingsCount: 2,
        }),
        run({
          status: "completed",
          startedAt: new Date("2026-11-05T11:05:00.000Z"),
          completedAt: new Date("2026-11-05T11:05:02.000Z"),
          findingsCount: 3,
        }),
        run({ status: "running", startedAt: new Date("2026-11-05T11:10:00.000Z"), completedAt: null, findingsCount: 0 }),
      ],
      NOW,
    );

    expect(summary.totals.avgDurationMs).toBe(3_000);
    expect(summary.totals.maxDurationMs).toBe(4_000);
    expect(summary.totals.findings).toBe(5);
  });

  it("returns runs newest-first and keeps only the ten most recent", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      run({
        id: `run_${index}`,
        startedAt: new Date(NOW.getTime() - index * 60_000),
        completedAt: new Date(NOW.getTime() - index * 60_000 + 1_000),
      }),
    );

    const summary = summarizeDetectionRuns(rows, NOW);

    expect(summary.recent).toHaveLength(10);
    expect(summary.recent[0]?.id).toBe("run_0");
    expect(summary.lastRun?.id).toBe("run_0");
    expect(summary.recent.at(-1)?.id).toBe("run_9");
  });

  it("treats a run without a completion timestamp as in-flight", () => {
    const summary = summarizeDetectionRuns(
      [run({ status: "failed", completedAt: null })],
      NOW,
    );

    expect(summary.totals.avgDurationMs).toBeNull();
    expect(summary.recent[0]?.durationMs).toBeNull();
  });
});
