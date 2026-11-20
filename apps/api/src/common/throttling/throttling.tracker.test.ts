import { describe, expect, it } from "vitest";
import { resolveThrottleTracker } from "./throttling.tracker";

describe("resolveThrottleTracker", () => {
  it("keys an authenticated route on the credential", () => {
    const a = resolveThrottleTracker({ ip: "1.1.1.1", url: "/api/v1/organization/o/logs", headers: { "x-api-key": "k1" } });
    const b = resolveThrottleTracker({ ip: "1.1.1.1", url: "/api/v1/organization/o/logs", headers: { "x-api-key": "k2" } });
    expect(a).not.toBe(b);
  });

  it("ignores a rotating header on anonymous routes", () => {
    const first = resolveThrottleTracker({ ip: "1.1.1.1", originalUrl: "/api/v1/auth/sign-in", headers: { "x-api-key": "fake1" } });
    const second = resolveThrottleTracker({ ip: "1.1.1.1", originalUrl: "/api/v1/auth/sign-in", headers: { authorization: "Bearer fake2" } });
    expect(first).toBe("address:1.1.1.1");
    expect(second).toBe(first);
  });

  it("ignores a rotating header on the public status page", () => {
    expect(resolveThrottleTracker({ ip: "2.2.2.2", url: "/api/v1/public/status/org/project", headers: { "x-api-key": "x" } })).toBe("address:2.2.2.2");
  });
});
