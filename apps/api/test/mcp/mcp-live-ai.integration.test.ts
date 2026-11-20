import "reflect-metadata";
import { ForbiddenException, Module, UnauthorizedException, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { MCP_ACTIONS_PORT, MCP_AUTHENTICATOR, MCP_ERRORS_PORT, MCP_FINDINGS_PORT, MCP_HOST_TOKENS, MCP_RCA_PORT, MCP_READ_SCOPE, MCP_TELEMETRY_PORT, MCP_WRITE_SCOPE, SoonwhyMcpModule } from "@soonwhy/mcp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../src/common/db";
import { rcaAnalyses, rcaInvocations } from "../../src/common/db/schema";
import { RcaApiService } from "../../src/modules/v1/detection/detections/application/rca.api";
import { RcaPersistenceService } from "../../src/modules/v1/detection/detections/application/rca.persistence";
import { RcaService } from "../../src/modules/v1/detection/detections/application/rca.service";
import { DatabaseRcaGovernanceSink } from "../../src/modules/v1/detection/detections/domain/rca.governance";
import { RcaAnalysisRepository } from "../../src/modules/v1/detection/detections/infrastructure/rca.repository";
import { FindingsService } from "../../src/modules/v1/detection/findings/application/findings.service";
import { FindingRepository } from "../../src/modules/v1/detection/findings/infrastructure/finding.repository";
import { upsertFinding } from "../../src/modules/v1/detection/findings/infrastructure/finding-upsert";
import { LlmCatalog } from "../../src/modules/v1/investigation/ai/application/llm-catalog.service";
import { LlmProviderResolver } from "../../src/modules/v1/investigation/ai/application/llm-provider.resolver";
import { CredentialCipher } from "../../src/modules/v1/investigation/ai/domain/credential-cipher";
import { AiRepository } from "../../src/modules/v1/investigation/ai/infrastructure/ai.repository";
import { McpActionsAdapter } from "../../src/modules/v1/investigation/mcp/mcp-actions.adapter";
import { BillingService } from "../../src/modules/v1/platform/billing/application/billing.service";
import { BillingRepository } from "../../src/modules/v1/platform/billing/infrastructure/billing.repository";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

const liveAi = databaseTestsEnabled && process.env.RUN_LIVE_AI === "1" && !!process.env.DEEPSEEK_API_KEY;
const MODEL = process.env.LIVE_AI_MODEL ?? "deepseek-v4-flash";
const unused = {};
let principal = { orgId: "", projectId: "", scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] };

const authenticator = {
  authenticate: async (authorization: string | undefined, options: { scope: string }) => {
    if (!authorization) throw new UnauthorizedException("Invalid API key");
    if (!principal.scopes.includes(options.scope)) throw new ForbiddenException("scope");
    return principal;
  },
};

@Module({
  providers: [
    McpActionsAdapter,
    { provide: FindingsService, useFactory: () => new FindingsService(new FindingRepository()) },
    {
      provide: RcaApiService,
      useFactory: () =>
        new RcaApiService(
          new RcaAnalysisRepository(),
          new RcaService(new LlmProviderResolver(new AiRepository(), CredentialCipher.fromEnv(), new LlmCatalog())),
          new RcaPersistenceService(new RcaAnalysisRepository()),
          new DatabaseRcaGovernanceSink(),
          new BillingService(new BillingRepository()),
        ),
    },
    { provide: MCP_AUTHENTICATOR, useValue: authenticator },
    { provide: MCP_ACTIONS_PORT, useExisting: McpActionsAdapter },
    { provide: MCP_ERRORS_PORT, useValue: unused },
    { provide: MCP_TELEMETRY_PORT, useValue: unused },
    { provide: MCP_FINDINGS_PORT, useValue: unused },
    { provide: MCP_RCA_PORT, useValue: unused },
  ],
  exports: MCP_HOST_TOKENS,
})
class TestHostModule {}

@Module({ imports: [SoonwhyMcpModule.register({ host: TestHostModule })] })
class TestAppModule {}

describe.skipIf(!liveAi)("MCP request_rca with a live model", () => {
  let app: INestApplication;
  let url: URL;
  let findingId: string;

  beforeAll(async () => {
    await resetDatabase();
    const organization = await createOrganization();
    const project = await createProject(organization!.id);
    principal = { orgId: organization!.id, projectId: project!.id, scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] };
    const apiKey = process.env.DEEPSEEK_API_KEY!;
    await new AiRepository().create(
      {
        orgId: organization!.id,
        name: "live test",
        provider: "deepseek",
        model: MODEL,
        baseUrl: null,
        encryptedApiKey: CredentialCipher.fromEnv().encrypt(apiKey),
        keyHint: apiKey.slice(-4),
      },
      true,
    );
    const at = new Date();
    findingId = (
      await upsertFinding(
        {
          orgId: organization!.id,
          projectId: project!.id,
          serviceName: "checkout-api",
          type: "error_group",
          severity: "critical",
          title: "TypeError: Cannot read properties of undefined (reading 'id')",
          description: "Error group in checkout-api",
          observedValue: 48,
          threshold: 1,
          unit: "errors",
          windowStart: at,
          windowEnd: at,
          evidence: [
            { kind: "metric", label: "Occurrences", value: 48, context: { traceCount: 9, firstSeen: "2026-11-20T08:00:00Z", lastSeen: "2026-11-20T08:20:00Z" } },
            { kind: "log", label: "Latest occurrence", value: "Cannot read properties of undefined (reading 'id')" },
            { kind: "log", label: "Application frames", value: "at CartService.total (/app/src/cart/cart.service.ts:42:31)\nat CheckoutController.pay (/app/src/checkout/checkout.controller.ts:18:22)" },
          ],
          fingerprint: "error:live",
        },
        at,
      )
    )!.id;
    app = await NestFactory.create(TestAppModule, { logger: ["error"] });
    await app.listen(0);
    url = new URL("/mcp", await app.getUrl());
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await closeDatabase();
  });

  it("produces a stored, validated RCA from a real model and records its cost", async () => {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: "Bearer any" } } }));
    const result = await client.callTool({ name: "request_rca", arguments: { findingId } });
    expect(result.isError, JSON.stringify(result.content)).not.toBe(true);

    const [row] = await db.select().from(rcaAnalyses);
    expect(row).toMatchObject({ findingId, provider: "deepseek", model: MODEL, credentialSource: "byok" });
    expect(row!.rootCause.length).toBeGreaterThan(20);
    expect(row!.confidence).toMatch(/low|medium|high/);
    const [invocation] = await db.select().from(rcaInvocations);
    console.log("live RCA:", JSON.stringify({ rootCause: row!.rootCause, confidence: row!.confidence, tokens: (row!.evidenceSnapshot as { rcaUsage?: unknown }).rcaUsage, status: invocation?.status }));

    const again = await client.callTool({ name: "request_rca", arguments: { findingId } });
    expect(again.isError).not.toBe(true);
    expect(await db.select().from(rcaAnalyses)).toHaveLength(1);
    await client.close();
  }, 120_000);
});
