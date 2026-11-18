import { describe, expect, it } from "vitest";
import { SubscribeToStatusPageDto } from "./status-page-subscription.dto";

describe("SubscribeToStatusPageDto", () => {
  it("normalizes the email", () => {
    expect(SubscribeToStatusPageDto.parse({ email: "  Ops@Example.com " }).email).toBe("ops@example.com");
  });

  it("rejects a malformed email", () => {
    expect(SubscribeToStatusPageDto.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a Slack URL that points at an internal address", () => {
    expect(SubscribeToStatusPageDto.safeParse({ email: "a@b.co", slackWebhookUrl: "http://169.254.169.254/" }).success).toBe(false);
  });

  it("accepts a public Slack webhook URL", () => {
    expect(SubscribeToStatusPageDto.safeParse({ email: "a@b.co", slackWebhookUrl: "https://hooks.slack.com/services/T/B/x" }).success).toBe(true);
  });
});
