import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { parseUsagePeriod, usagePeriodRange } from "./ai-usage-period";

const NOW = new Date("2026-11-18T13:30:00Z");

describe("parseUsagePeriod", () => {
  it("defaults to the current month", () => {
    expect(parseUsagePeriod(undefined)).toBe("month");
    expect(parseUsagePeriod("")).toBe("month");
  });

  it("accepts each known period", () => {
    expect(parseUsagePeriod("last_month")).toBe("last_month");
    expect(parseUsagePeriod("last_30_days")).toBe("last_30_days");
  });

  it("rejects anything else with a 400", () => {
    expect(() => parseUsagePeriod("year")).toThrow(BadRequestException);
    expect(() => parseUsagePeriod("MONTH")).toThrow(BadRequestException);
  });
});

describe("usagePeriodRange", () => {
  it("runs from the first of this month to now", () => {
    expect(usagePeriodRange("month", NOW)).toEqual({ start: new Date("2026-11-01T00:00:00Z"), end: NOW });
  });

  it("covers the whole previous month", () => {
    expect(usagePeriodRange("last_month", NOW)).toEqual({
      start: new Date("2026-10-01T00:00:00Z"),
      end: new Date("2026-11-01T00:00:00Z"),
    });
  });

  it("rolls over the year boundary", () => {
    expect(usagePeriodRange("last_month", new Date("2026-01-05T00:00:00Z"))).toEqual({
      start: new Date("2025-12-01T00:00:00Z"),
      end: new Date("2026-01-01T00:00:00Z"),
    });
  });

  it("covers the last 30 days up to now", () => {
    expect(usagePeriodRange("last_30_days", NOW)).toEqual({ start: new Date("2026-10-19T13:30:00Z"), end: NOW });
  });
});
