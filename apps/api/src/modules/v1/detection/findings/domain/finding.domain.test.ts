import { describe, expect, it } from "vitest";
import { CATEGORY_BY_TYPE } from "./finding-category.constants";
import { categoryOf } from "./finding-category";
import { findingFingerprint } from "./finding-fingerprint";
import { RECOMMENDATION_BY_TYPE } from "./finding-recommendation.constants";
import { recommendationFor } from "./finding-recommendation";
import { FindingListQuerySchema, FindingStatusBodySchema } from "./finding.schema";

describe("finding domain", () => {
  it("gives every finding type a category and a recommendation", () => {
    for (const type of Object.keys(CATEGORY_BY_TYPE)) {
      expect(categoryOf(type)).toBeTruthy();
      expect(recommendationFor(type)?.length).toBeGreaterThan(20);
    }
    expect(Object.keys(RECOMMENDATION_BY_TYPE)).toEqual(Object.keys(CATEGORY_BY_TYPE));
  });

  it("files exception groups under error and slow requests under performance", () => {
    expect(categoryOf("error_group")).toBe("error");
    expect(categoryOf("latency")).toBe("performance");
    expect(categoryOf("unknown_type")).toBe("performance");
    expect(recommendationFor("unknown_type")).toBeNull();
  });

  it("builds the same fingerprint for the same problem and a different one otherwise", () => {
    expect(findingFingerprint("latency", "api", "GET /a")).toBe(findingFingerprint("latency", "api", "GET /a"));
    expect(findingFingerprint("latency", "api", "GET /a")).not.toBe(findingFingerprint("latency", "api", "GET /b"));
    expect(findingFingerprint("latency", "api")).not.toBe(findingFingerprint("latency", "web"));
  });

  it("accepts only known statuses and bounds the list size", () => {
    expect(FindingStatusBodySchema.safeParse({ status: "resolved" }).success).toBe(true);
    expect(FindingStatusBodySchema.safeParse({ status: "done" }).success).toBe(false);
    expect(FindingStatusBodySchema.safeParse({ status: "open", extra: 1 }).success).toBe(false);
    expect(FindingListQuerySchema.parse({}).limit).toBe(50);
    expect(FindingListQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(FindingListQuerySchema.safeParse({ category: "bogus" }).success).toBe(false);
  });
});
