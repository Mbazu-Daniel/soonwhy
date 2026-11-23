import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlertNotifier } from "../src/pipeline/alert-notifier";
import { ALERT_COOLDOWN_MS } from "../src/pipeline/constants";

describe("alert notifier", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    process.env.INGEST_ALERT_WEBHOOK_URL = "https://hooks.example.test/abc";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.INGEST_ALERT_WEBHOOK_URL;
  });

  it("posts the message as JSON text to the configured webhook", async () => {
    expect(await new AlertNotifier().notify("rejected_docs", "something broke")).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.example.test/abc");
    expect(JSON.parse(init.body)).toEqual({ text: "something broke" });
  });

  it("does nothing when no webhook is configured", async () => {
    delete process.env.INGEST_ALERT_WEBHOOK_URL;

    expect(await new AlertNotifier().notify("rejected_docs", "x")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one alert per kind per cooldown, and other kinds are independent", async () => {
    const notifier = new AlertNotifier();
    await notifier.notify("a", "first", 0);

    expect(await notifier.notify("a", "again", ALERT_COOLDOWN_MS - 1)).toBe(false);
    expect(await notifier.notify("b", "other", 1)).toBe(true);
    expect(await notifier.notify("a", "later", ALERT_COOLDOWN_MS)).toBe(true);
  });

  it("does not throw on a failing webhook and does not start a cooldown, so the next one is retried", async () => {
    const notifier = new AlertNotifier();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 }).mockRejectedValueOnce(new Error("network down"));

    expect(await notifier.notify("a", "x", 0)).toBe(false);
    expect(await notifier.notify("a", "x", 1)).toBe(false);
    expect(await notifier.notify("a", "x", 2)).toBe(true);
  });
});
