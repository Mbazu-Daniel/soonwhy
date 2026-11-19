import { describe, expect, it } from "vitest";
import { isCleanupDue, retentionCutoff } from "./retention.schedule";

describe("retention schedule", () => {
  it("runs a policy that has never been cleaned", () => {
    expect(isCleanupDue(null, "daily", new Date("2026-11-05T04:00:00.000Z"))).toBe(true);
  });

  it("waits for the configured interval", () => {
    const now = new Date("2026-11-05T04:00:00.000Z");

    expect(isCleanupDue(new Date("2026-11-04T20:00:00.000Z"), "daily", now)).toBe(false);
    expect(isCleanupDue(new Date("2026-11-04T03:00:00.000Z"), "daily", now)).toBe(true);
    expect(isCleanupDue(new Date("2026-11-04T20:00:00.000Z"), "hourly", now)).toBe(true);
  });

  it("derives the retention cutoff from the policy window", () => {
    const cutoff = retentionCutoff(new Date("2026-11-05T00:00:00.000Z"), 30);

    expect(cutoff.toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });
});
