import { describe, expect, it } from "vitest";
import { retryDelayMs } from "./constants";

describe("retryDelayMs", () => {
  it("grows with the delivery count and stays between half and all of the base delay", () => {
    expect(retryDelayMs(1, () => 0)).toBe(500);
    expect(retryDelayMs(1, () => 1)).toBe(1000);
    expect(retryDelayMs(4, () => 0)).toBe(2000);
    expect(retryDelayMs(4, () => 1)).toBe(4000);
  });

  it("spreads retries of different messages apart", () => {
    const delays = new Set(Array.from({ length: 20 }, () => retryDelayMs(3)));
    expect(delays.size).toBeGreaterThan(1);
  });
});
