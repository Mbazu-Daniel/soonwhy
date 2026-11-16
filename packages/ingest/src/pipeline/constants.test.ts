import { describe, expect, it } from "vitest";
import { retryDelayMs } from "./constants";

describe("retryDelayMs", () => {
  it("grows exponentially with the delivery count, bounded by a 30s cap", () => {
    expect(retryDelayMs(1, () => 0)).toBe(0);
    expect(retryDelayMs(1, () => 1)).toBe(500);
    expect(retryDelayMs(2, () => 1)).toBe(1000);
    expect(retryDelayMs(3, () => 1)).toBe(2000);
    expect(retryDelayMs(4, () => 1)).toBe(4000);
    expect(retryDelayMs(20, () => 1)).toBe(30000);
  });

  it("spreads retries of different messages apart", () => {
    const delays = new Set(Array.from({ length: 20 }, () => retryDelayMs(3)));
    expect(delays.size).toBeGreaterThan(1);
  });
});
