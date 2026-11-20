import { describe, expect, it } from "vitest";
import { isIgnoredByRules, matchesIgnoreRule, rulesFingerprint } from "../domain/ignore-rules";
import { IgnoreRuleSchema } from "../domain/ignore-rules.schema";

const group = (errorType: string, path: string) => ({ errorType, errorMessage: `GET ${path}` });

describe("matchesIgnoreRule", () => {
  it("matches a path glob", () => {
    expect(matchesIgnoreRule(group("HTTP 404", "/internal/health/live"), { pathPattern: "/internal/*", status: null })).toBe(true);
  });

  it("ignores the query string", () => {
    expect(matchesIgnoreRule(group("HTTP 404", "/ping?x=1"), { pathPattern: "/ping", status: null })).toBe(true);
  });

  it("does not match a different path", () => {
    expect(matchesIgnoreRule(group("HTTP 404", "/api/orders"), { pathPattern: "/internal/*", status: null })).toBe(false);
  });

  it("only matches the given status", () => {
    const rule = { pathPattern: "/legacy/*", status: "404" };
    expect(matchesIgnoreRule(group("HTTP 404", "/legacy/a"), rule)).toBe(true);
    expect(matchesIgnoreRule(group("HTTP 500", "/legacy/a"), rule)).toBe(false);
  });

  it("treats regex characters in the pattern literally", () => {
    expect(matchesIgnoreRule(group("HTTP 404", "/a.b"), { pathPattern: "/a.b", status: null })).toBe(true);
    expect(matchesIgnoreRule(group("HTTP 404", "/axb"), { pathPattern: "/a.b", status: null })).toBe(false);
  });

  it("never matches an error without a path", () => {
    expect(matchesIgnoreRule({ errorType: "TypeError", errorMessage: "boom" }, { pathPattern: "/*", status: null })).toBe(false);
  });
});

describe("isIgnoredByRules", () => {
  it("is false with no rules", () => {
    expect(isIgnoredByRules(group("HTTP 404", "/x"), [])).toBe(false);
  });
  it("is true when any rule matches", () => {
    expect(isIgnoredByRules(group("HTTP 404", "/x"), [{ pathPattern: "/y", status: null }, { pathPattern: "/x", status: null }])).toBe(true);
  });
});

describe("rulesFingerprint", () => {
  it("is order independent", () => {
    const a = { pathPattern: "/a", status: null };
    const b = { pathPattern: "/b", status: "404" };
    expect(rulesFingerprint([a, b])).toBe(rulesFingerprint([b, a]));
  });
});

describe("IgnoreRuleSchema", () => {
  it("rejects a pattern that matches every path", () => {
    expect(IgnoreRuleSchema.safeParse({ pathPattern: "/*" }).success).toBe(false);
    expect(IgnoreRuleSchema.safeParse({ pathPattern: "*" }).success).toBe(false);
  });
  it("requires a leading slash", () => {
    expect(IgnoreRuleSchema.safeParse({ pathPattern: "internal/*" }).success).toBe(false);
  });
  it("accepts a path with an optional status", () => {
    expect(IgnoreRuleSchema.parse({ pathPattern: "/internal/*", status: "404" })).toEqual({ pathPattern: "/internal/*", status: "404" });
    expect(IgnoreRuleSchema.parse({ pathPattern: "/internal/*" }).status).toBeNull();
  });
  it("rejects a malformed status", () => {
    expect(IgnoreRuleSchema.safeParse({ pathPattern: "/a/*", status: "abc" }).success).toBe(false);
  });
});
