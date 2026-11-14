import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Controller, Get, HttpException, Module } from "@nestjs/common";
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

  @Get("/boom")
  boom() {
    throw new Error("boom");
  }

  @Get("/missing")
  missing() {
    throw new HttpException("nope", 404);
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

  it("captures unhandled request errors with a stack but not 4xx", async () => {
    const app = await NestFactory.create(TestAppModule, { logger: false });
    await app.listen(0);
    const sdk = app.get(SOONWHY_SDK, { strict: false }) as NodeSdk;
    const captured: unknown[] = [];
    const attributes: Array<Record<string, unknown> | undefined> = [];
    const original = sdk.captureError.bind(sdk);
    sdk.captureError = (input) => {
      captured.push(input.error);
      attributes.push(input.attributes);
      original(input);
    };
    const base = await app.getUrl();
    const boom = await fetch(`${base}/boom`);
    const missing = await fetch(`${base}/missing`);
    expect(boom.status).toBe(500);
    expect(missing.status).toBe(404);
    expect(captured).toHaveLength(1);
    expect((captured[0] as Error).stack).toContain("boom");
    expect(attributes[0]).toMatchObject({
      "exception.mechanism": "nest.exception_filter",
      "http.request.method": "GET",
      "http.route": "/boom",
      "http.status_code": 500,
    });
    await app.close();
  }, 30_000);
});
