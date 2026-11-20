import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { McpServerModule } from "../../mcp";
import { InvestigationChatController } from "./investigation-chat.controller";
import { InvestigationChatModule } from "./investigation-chat.module";
import { InvestigationChatService } from "./investigation-chat.service";

@Module({ imports: [InvestigationChatModule, McpServerModule] })
class AssembledModules {}

describe("investigation modules", () => {
  let context: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;

  beforeAll(async () => {
    process.env.SOONWHY_PII_ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString("base64");
    context = await NestFactory.createApplicationContext(AssembledModules, { logger: ["error"], abortOnError: false });
  }, 90_000);

  afterAll(async () => {
    await context?.close();
  });

  it("assembles the chat service and controller with their real dependencies", () => {
    expect(context.get(InvestigationChatService, { strict: false })).toBeInstanceOf(InvestigationChatService);
    expect(context.get(InvestigationChatController, { strict: false })).toBeInstanceOf(InvestigationChatController);
  });
});
