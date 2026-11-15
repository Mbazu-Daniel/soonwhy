import { describe, expect, it, vi } from "vitest";
import { WebhookDeliveries } from "./webhook-deliveries";

describe("WebhookDeliveries", () => {
  it("accepts a delivery the first time it is seen", async () => {
    const redis = { set: vi.fn().mockResolvedValue("OK") };
    const deliveries = new WebhookDeliveries(redis as never);

    await expect(deliveries.claim("d-1")).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      "soonwhy:github:delivery:d-1",
      "1",
      "EX",
      604_800,
      "NX",
    );
  });

  it("rejects a delivery that was already recorded", async () => {
    const redis = { set: vi.fn().mockResolvedValue(null) };
    const deliveries = new WebhookDeliveries(redis as never);

    await expect(deliveries.claim("d-1")).resolves.toBe(false);
  });

  it("processes the delivery when Redis cannot be reached, so no push is lost", async () => {
    const redis = { set: vi.fn().mockRejectedValue(new Error("connection refused")) };
    const deliveries = new WebhookDeliveries(redis as never);

    await expect(deliveries.claim("d-1")).resolves.toBe(true);
  });
});
