import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { parseEntryId, parseEntryIds, parseRetentionDays } from "./dlq.validation";

describe("parseRetentionDays", () => {
  it("defaults to 7 when nothing is given", () => {
    expect(parseRetentionDays(undefined)).toBe(7);
    expect(parseRetentionDays(null)).toBe(7);
  });

  it("accepts integers from 1 to 365", () => {
    expect(parseRetentionDays(1)).toBe(1);
    expect(parseRetentionDays(365)).toBe(365);
  });

  it.each([0, -1, 1.5, 366, Number.NaN, Number.POSITIVE_INFINITY, "7", true])("rejects %s", (value) => {
    expect(() => parseRetentionDays(value)).toThrow(BadRequestException);
  });
});

describe("parseEntryIds", () => {
  it("removes duplicates and keeps the first-seen order", () => {
    expect(parseEntryIds([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
  });

  it("allows exactly 100 distinct ids and rejects 101", () => {
    expect(parseEntryIds(Array.from({ length: 100 }, (_, i) => i + 1))).toHaveLength(100);
    expect(() => parseEntryIds(Array.from({ length: 101 }, (_, i) => i + 1))).toThrow(BadRequestException);
  });

  it("counts only distinct ids against the cap", () => {
    const ids = Array.from({ length: 300 }, (_, i) => (i % 100) + 1);
    expect(parseEntryIds(ids)).toHaveLength(100);
  });

  it.each([undefined, null, "1", {}, [], [1, "2"], [1.5], [0], [-3], [Number.NaN]])("rejects %j", (value) => {
    expect(() => parseEntryIds(value)).toThrow(BadRequestException);
  });
});

describe("parseEntryId", () => {
  it("parses a positive integer", () => {
    expect(parseEntryId("42")).toBe(42);
  });

  it.each(["abc", "bulk-delete", "0", "-1", "1.5", "", " "])("rejects %j", (value) => {
    expect(() => parseEntryId(value)).toThrow(BadRequestException);
  });
});
