import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RcaApiService } from "./rca.api";
import { RcaController } from "./rca.controller";
import { RcaModule } from "./rca.module";

describe("RcaModule", () => {
  let context: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;

  beforeAll(async () => {
    process.env.SOONWHY_PII_ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString("base64");
    context = await NestFactory.createApplicationContext(RcaModule, { logger: ["error"], abortOnError: false });
  }, 60_000);

  afterAll(async () => {
    await context?.close();
  });

  it("resolves the RCA API service and controller", () => {
    expect(context.get(RcaApiService)).toBeInstanceOf(RcaApiService);
    expect(context.select(RcaModule).get(RcaController, { strict: false })).toBeInstanceOf(RcaController);
  });
});
