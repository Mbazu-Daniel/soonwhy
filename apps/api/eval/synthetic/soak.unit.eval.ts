import { describe, expect, it } from "vitest";
import { runSoak } from "./soak";
import { SIX_SERVICES } from "./topologies";

describe("soak harness", () => {
  it("reports no finding episodes for one healthy simulated hour", { timeout: 120_000 }, () => {
    expect(runSoak(SIX_SERVICES, 1).findingEpisodes).toBe(0);
  });

  it("does report an episode when a fault starts, so a clean soak means something", { timeout: 120_000 }, () => {
    const result = runSoak(SIX_SERVICES, 1, { fromRequest: 600, faults: { db: { delayMs: 400 } } });
    expect(result.findingEpisodes).toBeGreaterThanOrEqual(1);
    expect(result.snapshotsPerHour).toBeGreaterThan(0);
  });
});
