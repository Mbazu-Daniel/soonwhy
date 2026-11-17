import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeWindowParser } from "./time-window-parser";

const NOW = new Date("2026-11-17T12:00:00.000Z");

describe("TimeWindowParser", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing when no window is given", () => {
    expect(TimeWindowParser.parse(undefined)).toBeUndefined();
    expect(TimeWindowParser.parse("")).toBeUndefined();
  });

  it.each([
    ["30s", 30_000],
    ["5m", 5 * 60_000],
    ["2h", 2 * 3_600_000],
    ["1d", 86_400_000],
  ])("reads %s as %i milliseconds ending now", (window, milliseconds) => {
    const parsed = TimeWindowParser.parse(window);
    expect(parsed?.end.getTime()).toBe(NOW.getTime());
    expect(parsed?.start.getTime()).toBe(NOW.getTime() - milliseconds);
  });

  it("falls back to one hour for an unreadable duration", () => {
    const parsed = TimeWindowParser.parse("soon");
    expect(parsed!.end.getTime() - parsed!.start.getTime()).toBe(3_600_000);
  });

  it("ignores the offset after the slash", () => {
    const parsed = TimeWindowParser.parse("5m/10m");
    expect(parsed?.end.getTime()).toBe(NOW.getTime());
    expect(parsed?.start.getTime()).toBe(NOW.getTime() - 5 * 60_000);
  });
});
