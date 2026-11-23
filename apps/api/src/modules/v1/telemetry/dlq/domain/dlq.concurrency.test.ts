import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./dlq.concurrency";

describe("mapWithConcurrency", () => {
  it("never runs more tasks at once than the limit", async () => {
    let running = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 5, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
    });

    expect(peak).toBe(5);
  });

  it("returns results in input order even when tasks finish out of order", async () => {
    const results = await mapWithConcurrency([30, 1, 15], 3, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return delay;
    });

    expect(results).toEqual([30, 1, 15]);
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 5, async () => 1)).toEqual([]);
  });
});
