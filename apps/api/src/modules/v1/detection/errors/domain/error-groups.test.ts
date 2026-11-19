import { describe, expect, it } from "vitest";
import { errorFingerprint, errorTypeOf, normalizeErrorMessage } from "./error-fingerprint";
import { buildTimeline, groupErrorLogs, occurrencesOf, traceIdsOf } from "./error-groups";
import type { ErrorLogSource } from "./error.types";

function log(overrides: Partial<ErrorLogSource> = {}): ErrorLogSource {
  return {
    id: "log-1",
    timestamp: "2026-11-14T10:00:00.000Z",
    service: "api",
    level: "error",
    message: "GET /requests 500",
    traceId: "",
    spanId: "",
    ...overrides,
  };
}

describe("normalizeErrorMessage", () => {
  it("drops query strings after a path", () => {
    expect(normalizeErrorMessage("GET /requests?categoryId=%00 500")).toBe("GET /requests 500");
  });

  it("replaces ids and long numbers", () => {
    expect(normalizeErrorMessage("GET /requests/12345/items/9 404")).toBe("GET /requests/:id/items/:id 404");
    expect(normalizeErrorMessage("user 550e8400-e29b-41d4-a716-446655440000 failed")).toBe("user <id> failed");
    expect(normalizeErrorMessage("timeout after 30000 ms")).toBe("timeout after <n> ms");
  });

  it("keeps the status code and plain words", () => {
    expect(normalizeErrorMessage("GET /requests 500")).toBe("GET /requests 500");
  });
});

describe("errorFingerprint", () => {
  it("is never empty", () => {
    expect(errorFingerprint(log())).toMatch(/^[0-9a-f]{16}$/);
    expect(errorFingerprint(log({ traceId: "" }))).not.toBe("");
  });

  it("is stable across ids, queries and traces", () => {
    const a = errorFingerprint(log({ message: "GET /requests?categoryId=a 500", traceId: "t1" }));
    const b = errorFingerprint(log({ message: "GET /requests?categoryId=b 500", traceId: "t2" }));
    expect(a).toBe(b);
  });

  it("differs by message, service and type", () => {
    const base = errorFingerprint(log());
    expect(errorFingerprint(log({ message: "GET /users 500" }))).not.toBe(base);
    expect(errorFingerprint(log({ service: "web" }))).not.toBe(base);
    expect(errorFingerprint(log({ attributes: { "exception.type": "TypeError" } }))).not.toBe(base);
  });
});

describe("errorTypeOf", () => {
  it("prefers the exception type, then the http status", () => {
    expect(errorTypeOf(log({ attributes: { "exception.type": "TypeError" } }))).toBe("TypeError");
    expect(errorTypeOf(log({ attributes: JSON.stringify({ "http.status_code": 500 }) }))).toBe("HTTP 500");
    expect(errorTypeOf(log())).toBe("Error");
  });
});

describe("groupErrorLogs", () => {
  it("merges the same error and keeps different errors apart", () => {
    const groups = groupErrorLogs([
      log({ id: "1", timestamp: "2026-11-14T10:00:00.000Z", message: "GET /requests?a=1 500", traceId: "t1" }),
      log({ id: "2", timestamp: "2026-11-14T10:05:00.000Z", message: "GET /requests?a=2 500", traceId: "t2" }),
      log({ id: "3", timestamp: "2026-11-14T10:02:00.000Z", message: "GET /users 500", traceId: "t3" }),
    ]);
    expect(groups).toHaveLength(2);
    const requests = groups.find((group) => group.errorMessage.includes("/requests"))!;
    expect(requests.count).toBe(2);
    expect(requests.traceCount).toBe(2);
    expect(requests.firstSeen).toBe("2026-11-14T10:00:00.000Z");
    expect(requests.lastSeen).toBe("2026-11-14T10:05:00.000Z");
  });

  it("points at the latest occurrence", () => {
    const [group] = groupErrorLogs([
      log({ id: "old", timestamp: "2026-11-14T10:00:00.000Z", traceId: "t-old", spanId: "s-old" }),
      log({ id: "new", timestamp: "2026-11-14T11:00:00.000Z", traceId: "t-new", spanId: "s-new", stackTrace: "boom" }),
    ]);
    expect(group).toMatchObject({ logId: "new", traceId: "t-new", spanId: "s-new", exception: "boom" });
  });

  it("sorts groups by most recent first", () => {
    const groups = groupErrorLogs([
      log({ message: "a failed", timestamp: "2026-11-14T09:00:00.000Z" }),
      log({ message: "b failed", timestamp: "2026-11-14T12:00:00.000Z" }),
    ]);
    expect(groups.map((group) => group.errorMessage)).toEqual(["b failed", "a failed"]);
  });

  it("counts a group without traces as zero traces", () => {
    expect(groupErrorLogs([log()])[0]!.traceCount).toBe(0);
  });
});

describe("environments on a group", () => {
  const sources = [
    log({ id: "1", timestamp: "2026-11-14T15:08:15Z", environment: "development", message: "POST /sign-in 401", attributes: { "http.status_code": "401" } }),
    log({ id: "2", timestamp: "2026-11-16T00:15:13Z", environment: "production", message: "POST /sign-in 401", attributes: { "http.status_code": "401" } }),
    log({ id: "3", timestamp: "2026-11-16T00:20:00Z", message: "POST /sign-in 401", attributes: { "http.status_code": "401" } }),
  ];

  it("lists every environment seen, sorted, ignoring blanks", () => {
    const [group] = groupErrorLogs(sources);
    expect(group?.environments).toEqual(["development", "production"]);
  });

  it("counts only the chosen environment", () => {
    const filtered = sources.filter((item) => item.environment === "production");
    const [group] = groupErrorLogs(filtered);
    expect(group?.count).toBe(1);
    expect(group?.environments).toEqual(["production"]);
  });

  it("keeps occurrences without an environment under all environments", () => {
    const [group] = groupErrorLogs(sources);
    expect(group?.count).toBe(3);
  });
});

describe("occurrencesOf and buildTimeline", () => {
  const sources = [
    log({ id: "1", timestamp: "2026-11-14T10:00:00.000Z", traceId: "t1" }),
    log({ id: "2", timestamp: "2026-11-14T11:00:00.000Z", traceId: "t2" }),
    log({ id: "3", timestamp: "2026-11-14T11:30:00.000Z", message: "other failure" }),
  ];
  const fingerprint = errorFingerprint(sources[0]!);

  it("lists only the matching occurrences, newest first", () => {
    const occurrences = occurrencesOf(sources, fingerprint);
    expect(occurrences.map((item) => item.id)).toEqual(["2", "1"]);
    expect(occurrences[0]!.traceId).toBe("t2");
  });

  it("buckets matching occurrences across the range", () => {
    const start = Date.parse("2026-11-14T10:00:00.000Z");
    const end = Date.parse("2026-11-14T12:00:00.000Z");
    const timeline = buildTimeline(sources, fingerprint, { start, end });
    expect(timeline).toHaveLength(24);
    expect(timeline.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2);
    expect(timeline[0]!.count).toBe(1);
  });
});

describe("traceIdsOf", () => {
  const entry = (traceId: string | undefined, timestamp: string) => ({ timestamp, service: "api", level: "error", message: "boom", traceId });

  it("lists each trace of the group once, newest first, without sources that have no trace", () => {
    const sources = [entry("t1", "2026-11-14T10:00:00.000Z"), entry("t2", "2026-11-14T11:00:00.000Z"), entry("t1", "2026-11-14T12:00:00.000Z"), entry(undefined, "2026-11-14T13:00:00.000Z")];
    const fingerprint = errorFingerprint(sources[0]!);
    expect(traceIdsOf(sources, fingerprint)).toEqual(["t1", "t2"]);
  });

  it("stops at the limit", () => {
    const sources = ["a", "b", "c"].map((id, index) => entry(id, `2026-11-14T10:0${index}:00.000Z`));
    expect(traceIdsOf(sources, errorFingerprint(sources[0]!), 2)).toEqual(["c", "b"]);
  });
});

describe("PII in error messages", () => {
  const source = (email: string) => ({
    id: email,
    service: "api",
    level: "error",
    timestamp: "2026-11-14T10:00:00Z",
    message: `user pii:v1:${email} failed`,
    stackTrace: `Error: pii:v1:${email}\n    at run (/app/src/run.ts:1:1)`,
  });

  it("groups messages that differ only by an encrypted PII value", () => {
    const groups = groupErrorLogs([source("AAAA_1"), source("BBBB-2")] as never);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.count).toBe(2);
  });

  it("never exposes the ciphertext in the message or stack", () => {
    const [group] = groupErrorLogs([source("AAAA_1")] as never);
    expect(group!.errorMessage).toBe("user [redacted] failed");
    expect(group!.exception).not.toContain("pii:v1:");
    expect(group!.exception).toContain("at run (/app/src/run.ts:1:1)");
  });
});
