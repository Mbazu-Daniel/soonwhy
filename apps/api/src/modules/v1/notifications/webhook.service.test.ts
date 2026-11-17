import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutboundHttpError } from "../../../common/resilience/outbound-http.errors";
import { WebhookService } from "./webhook.service";

const NOW = new Date("2026-11-17T12:00:00.000Z");

function build(request: ReturnType<typeof vi.fn>) {
  return new WebhookService({ request } as never);
}

describe("WebhookService.deliver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts the json payload with the event headers", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await build(request).deliver({ url: "https://hooks.example.com/a", payload: { subject: "s" }, eventType: "alert.triggered", eventId: "evt-1" });
    expect(result).toEqual({ ok: true, statusCode: 200 });
    const call = request.mock.calls[0]![0];
    expect(call.url).toBe("https://hooks.example.com/a");
    expect(call.init.method).toBe("POST");
    expect(call.init.body).toBe(JSON.stringify({ subject: "s" }));
    expect(call.init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Soonwhy-Event": "alert.triggered",
      "X-Soonwhy-Event-Id": "evt-1",
      "X-Soonwhy-Timestamp": String(NOW.getTime()),
    });
  });

  it("signs the timestamp and body with the secret", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    await build(request).deliver({ url: "https://hooks.example.com/a", secret: "shh", payload: { a: 1 }, eventType: "alert.triggered" });
    const headers = request.mock.calls[0]![0].init.headers;
    const expected = createHmac("sha256", "shh").update(`${NOW.getTime()}.${JSON.stringify({ a: 1 })}`).digest("hex");
    expect(headers["X-Soonwhy-Signature"]).toBe(`sha256=${expected}`);
  });

  it("sends no signature and no event id when neither is given", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await build(request).deliver({ url: "https://hooks.example.com/a", payload: {}, eventType: "alert.triggered" });
    const headers = request.mock.calls[0]![0].init.headers;
    expect(headers).not.toHaveProperty("X-Soonwhy-Signature");
    expect(headers).not.toHaveProperty("X-Soonwhy-Event-Id");
  });

  it("reports a non-success response without an error", async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(build(request).deliver({ url: "https://hooks.example.com/a", payload: {}, eventType: "e" })).resolves.toEqual({ ok: false, statusCode: 503 });
  });

  it("returns the status code and message of an outbound http error", async () => {
    const request = vi.fn().mockRejectedValue(new OutboundHttpError(429, "rate limited"));
    await expect(build(request).deliver({ url: "https://hooks.example.com/a", payload: {}, eventType: "e" })).resolves.toEqual({
      ok: false,
      statusCode: 429,
      error: "rate limited",
    });
  });

  it("returns the message of any other error without a status code", async () => {
    const request = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
    await expect(build(request).deliver({ url: "https://hooks.example.com/a", payload: {}, eventType: "e" })).resolves.toEqual({
      ok: false,
      statusCode: undefined,
      error: "connect ECONNREFUSED",
    });
  });
});
