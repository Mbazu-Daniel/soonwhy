import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Controller, Get, Module } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { SoonwhyModule } from "./soonwhy.module.js";
import { SOONWHY_SDK } from "./constants.js";
import type { NodeSdk } from "@soonwhy/node";

@Controller()
class TestController {
  @Get("/health")
  health() {
    return { ok: true };
  }
}

const options = {
  apiKey: "soonwhy-nest-test-key",
  serviceName: "soonwhy-nest-test",
  environment: "test",
  endpoint: "http://localhost:9/v1",
  flushIntervalMs: 0,
  registerShutdownHandlers: false,
} as const;

@Module({
  imports: [SoonwhyModule.forRoot({ ...options })],
  controllers: [TestController],
})
class TestAppModule {}

describe("SoonwhyModule", () => {
  it("starts the Node SDK and exposes it as an injectable token", async () => {
    const app = await NestFactory.create(TestAppModule, { logger: false });

    const sdk = app.get(SOONWHY_SDK, { strict: false }) as NodeSdk;
    expect(sdk.isStarted()).toBe(true);

    await app.close();
    expect(sdk.isStarted()).toBe(false);
  }, 30_000);
});
