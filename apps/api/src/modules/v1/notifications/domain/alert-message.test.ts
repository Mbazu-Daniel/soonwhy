import { describe, expect, it } from "vitest";
import { buildAlertMessage } from "./alert-message";

const base = {
  ruleName: "Checkout errors",
  severity: "high",
  metric: "http.server.request.errors.rate",
  operator: "gt",
  value: 50,
  threshold: 5,
  firedAt: new Date("2026-11-20T13:44:00.000Z"),
};

describe("buildAlertMessage", () => {
  it("says what happened in plain words with units", () => {
    const message = buildAlertMessage(base);
    expect(message.title).toBe("[HIGH] Checkout errors");
    expect(message.body).toContain("Error rate is above 5%: now 50%");
    expect(message.body).toContain("Threshold: above 5%");
    expect(message.body).toContain("Detected at: Fri, 20 Nov 2026 13:44:00 GMT");
  });

  it("lists failing endpoints and the investigate link when known", () => {
    const message = buildAlertMessage({
      ...base,
      projectName: "Shop",
      failingRoutes: [{ route: "POST /checkout", failures: 30 }],
      findingUrl: "https://app.example/o/p/intelligence/findings",
    });
    expect(message.title).toBe("[HIGH] Checkout errors in Shop");
    expect(message.body).toContain("POST /checkout: 30 failed");
    expect(message.htmlBody).toContain('href="https://app.example/o/p/intelligence/findings"');
  });

  it("escapes text that came from users", () => {
    const message = buildAlertMessage({ ...base, ruleName: "<script>x</script>", description: "a & b" });
    expect(message.htmlBody).not.toContain("<script>");
    expect(message.htmlBody).toContain("a &amp; b");
  });

  it("formats latency and unknown metrics", () => {
    expect(buildAlertMessage({ ...base, metric: "http.server.request.duration.p95", value: 1939.5, threshold: 1000 }).body).toContain("now 1940 ms");
    expect(buildAlertMessage({ ...base, metric: "custom.thing", value: 3, threshold: 1, operator: "weird" }).body).toContain("custom.thing weird 1: now 3");
  });
});
