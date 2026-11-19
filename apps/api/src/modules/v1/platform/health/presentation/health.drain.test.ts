import { describe, expect, it, vi } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import { beginDrain } from "../../../../../common/shutdown/shutdown-state";
import { HealthController } from "./health.controller";

describe("readiness while draining", () => {
  it("returns 503 without querying dependencies once shutdown has begun", async () => {
    const health = { readiness: vi.fn() };
    const controller = new HealthController(health as never);
    beginDrain();
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(health.readiness).not.toHaveBeenCalled();
  });
});
