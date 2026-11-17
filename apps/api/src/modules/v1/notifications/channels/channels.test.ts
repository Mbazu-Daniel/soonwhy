import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailChannel } from "./email.channel";
import { SlackChannel } from "./slack.channel";
import { WebhookChannel } from "./webhook.channel";

const INPUT = { to: ["a@example.com", "b@example.com"], subject: "Alert", body: "plain", htmlBody: "<b>html</b>" };

describe("EmailChannel", () => {
  const original = { provider: process.env.EMAIL_PROVIDER, from: process.env.DEFAULT_FROM_EMAIL };

  beforeEach(() => {
    delete process.env.EMAIL_PROVIDER;
    process.env.DEFAULT_FROM_EMAIL = "alerts@soonwhy.test";
  });

  afterEach(() => {
    if (original.provider === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = original.provider;
    if (original.from === undefined) delete process.env.DEFAULT_FROM_EMAIL;
    else process.env.DEFAULT_FROM_EMAIL = original.from;
  });

  function build() {
    const zepto = { send: vi.fn().mockResolvedValue(undefined) };
    const resend = { send: vi.fn().mockResolvedValue(undefined) };
    return { zepto, resend, channel: new EmailChannel(zepto as never, resend as never) };
  }

  it("sends through resend by default with html and text bodies", async () => {
    const { channel, resend, zepto } = build();
    await expect(channel.send(INPUT)).resolves.toEqual({ ok: true });
    expect(resend.send).toHaveBeenCalledWith({ to: INPUT.to, subject: "Alert", html: "<b>html</b>", text: "plain" });
    expect(zepto.send).not.toHaveBeenCalled();
  });

  it("uses the plain body as html when there is no html body", async () => {
    const { channel, resend } = build();
    await channel.send({ ...INPUT, htmlBody: undefined });
    expect(resend.send).toHaveBeenCalledWith(expect.objectContaining({ html: "plain" }));
  });

  it("sends through zeptomail when configured, from the default sender", async () => {
    process.env.EMAIL_PROVIDER = " ZeptoMail ";
    const { channel, resend, zepto } = build();
    await expect(channel.send(INPUT)).resolves.toEqual({ ok: true });
    expect(zepto.send).toHaveBeenCalledWith({
      from: { name: "Soonwhy", address: "alerts@soonwhy.test" },
      to: [{ email_address: "a@example.com" }, { email_address: "b@example.com" }],
      subject: "Alert",
      htmlbody: "<b>html</b>",
      textbody: "plain",
    });
    expect(resend.send).not.toHaveBeenCalled();
  });

  it("refuses an unknown provider without sending", async () => {
    process.env.EMAIL_PROVIDER = "carrier-pigeon";
    const { channel, resend, zepto } = build();
    const result = await channel.send(INPUT);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("carrier-pigeon");
    expect(resend.send).not.toHaveBeenCalled();
    expect(zepto.send).not.toHaveBeenCalled();
  });

  it("reports the provider's own message when sending fails", async () => {
    const { channel, resend } = build();
    resend.send.mockRejectedValue({ message: "generic", response: { data: { message: "domain not verified" } } });
    await expect(channel.send(INPUT)).resolves.toEqual({ ok: false, error: "domain not verified" });
  });

  it("falls back to the error message, then to a fixed message", async () => {
    const { channel, resend } = build();
    resend.send.mockRejectedValueOnce(new Error("socket hang up"));
    await expect(channel.send(INPUT)).resolves.toEqual({ ok: false, error: "socket hang up" });
    resend.send.mockRejectedValueOnce({});
    await expect(channel.send(INPUT)).resolves.toEqual({ ok: false, error: "Email send failed" });
  });
});

describe("SlackChannel", () => {
  function build(sendMessage: ReturnType<typeof vi.fn>) {
    return new SlackChannel({ sendMessage } as never);
  }

  it("posts the body to the channel and returns the message timestamp", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, ts: "1731844800.000100" });
    const result = await build(sendMessage).sendTo("xoxb-token", "C123", { ...INPUT, htmlBody: undefined });
    expect(result).toEqual({ ok: true, providerMessageId: "1731844800.000100" });
    expect(sendMessage).toHaveBeenCalledWith("xoxb-token", { channel: "C123", text: "plain", blocks: undefined });
  });

  it("adds a section block when there is an html body", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, ts: "1" });
    await build(sendMessage).sendTo("xoxb-token", "C123", INPUT);
    expect(sendMessage).toHaveBeenCalledWith("xoxb-token", {
      channel: "C123",
      text: "plain",
      blocks: [{ type: "section", text: { type: "mrkdwn", text: "<b>html</b>" } }, { type: "divider" }],
    });
  });

  it("returns slack's error when it rejects the message", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: false, error: "channel_not_found" });
    await expect(build(sendMessage).sendTo("t", "C1", INPUT)).resolves.toEqual({ ok: false, error: "channel_not_found" });
  });

  it("returns a failure instead of throwing when the request fails", async () => {
    const sendMessage = vi.fn().mockRejectedValue({ message: "boom", response: { data: { error: "invalid_auth" } } });
    await expect(build(sendMessage).sendTo("t", "C1", INPUT)).resolves.toEqual({ ok: false, error: "invalid_auth" });
    sendMessage.mockRejectedValue(new Error("timeout"));
    await expect(build(sendMessage).sendTo("t", "C1", INPUT)).resolves.toEqual({ ok: false, error: "timeout" });
    sendMessage.mockRejectedValue({});
    await expect(build(sendMessage).sendTo("t", "C1", INPUT)).resolves.toEqual({ ok: false, error: "Slack send failed" });
  });
});

describe("WebhookChannel", () => {
  const WEBHOOK = { ...INPUT, url: "https://hooks.example.com/soonwhy", secret: "shh", metadata: { incidentId: "i1" } };

  it("delivers the alert as the payload with the alert.triggered event by default", async () => {
    const deliver = vi.fn().mockResolvedValue({ ok: true, statusCode: 200 });
    const result = await new WebhookChannel({ deliver } as never).send(WEBHOOK);
    expect(result).toEqual({ ok: true });
    expect(deliver).toHaveBeenCalledWith({
      url: WEBHOOK.url,
      secret: "shh",
      eventType: "alert.triggered",
      payload: { subject: "Alert", body: "plain", htmlBody: "<b>html</b>", metadata: { incidentId: "i1" }, to: INPUT.to },
    });
  });

  it("uses the event type it is given", async () => {
    const deliver = vi.fn().mockResolvedValue({ ok: true });
    await new WebhookChannel({ deliver } as never).send({ ...WEBHOOK, eventType: "alert.retry" });
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ eventType: "alert.retry" }));
  });

  it("reports the endpoint's failure", async () => {
    const deliver = vi.fn().mockResolvedValue({ ok: false, statusCode: 500, error: "HTTP 500" });
    await expect(new WebhookChannel({ deliver } as never).send(WEBHOOK)).resolves.toEqual({ ok: false, error: "HTTP 500" });
  });

  it("returns a failure instead of throwing when delivery throws", async () => {
    const deliver = vi.fn().mockRejectedValue(new Error("dns failure"));
    await expect(new WebhookChannel({ deliver } as never).send(WEBHOOK)).resolves.toEqual({ ok: false, error: "dns failure" });
    deliver.mockRejectedValue({});
    await expect(new WebhookChannel({ deliver } as never).send(WEBHOOK)).resolves.toEqual({ ok: false, error: "Webhook send failed" });
  });
});
