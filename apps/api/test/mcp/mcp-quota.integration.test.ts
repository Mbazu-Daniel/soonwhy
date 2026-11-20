import "reflect-metadata";
import { ForbiddenException, Module, UnauthorizedException, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { MCP_ACTIONS_PORT, MCP_AUTHENTICATOR, MCP_ERRORS_PORT, MCP_FINDINGS_PORT, MCP_HOST_TOKENS, MCP_RCA_PORT, MCP_READ_SCOPE, MCP_TELEMETRY_PORT, MCP_WRITE_SCOPE, SoonwhyMcpModule } from "@soonwhy/mcp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/common/db";
import { rcaAnalyses } from "../../src/common/db/schema";
import { RcaApiService } from "../../src/modules/v1/detection/detections/application/rca.api";
import { RcaPersistenceService } from "../../src/modules/v1/detection/detections/application/rca.persistence";
import { DatabaseRcaGovernanceSink } from "../../src/modules/v1/detection/detections/domain/rca.governance";
import { RcaAnalysisRepository } from "../../src/modules/v1/detection/detections/infrastructure/rca.repository";
import { FindingsService } from "../../src/modules/v1/detection/findings/application/findings.service";
import { FindingRepository } from "../../src/modules/v1/detection/findings/infrastructure/finding.repository";
import { upsertFinding } from "../../src/modules/v1/detection/findings/infrastructure/finding-upsert";
import { McpActionsAdapter } from "../../src/modules/v1/investigation/mcp/mcp-actions.adapter";
import { BillingService } from "../../src/modules/v1/platform/billing/application/billing.service";
import { BillingRepository } from "../../src/modules/v1/platform/billing/infrastructure/billing.repository";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

const llm = { describe: vi.fn(), analyzeEvidence: vi.fn(), analyze: vi.fn() };
const billingRepository = new BillingRepository();
const billing = new BillingService(billingRepository);
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
        new RcaApiService(new RcaAnalysisRepository(), llm as never, new RcaPersistenceService(new RcaAnalysisRepository()), new DatabaseRcaGovernanceSink(), billing),
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

describe.skipIf(!databaseTestsEnabled)("MCP request_rca with the platform AI quota enforced", () => {
  let app: INestApplication;
  let url: URL;
  let first: string;
  let second: string;
  const previousEnforced = process.env.SOONWHY_AI_QUOTA_ENFORCED;

  beforeAll(async () => {
    process.env.SOONWHY_AI_QUOTA_ENFORCED = "true";
    app = await NestFactory.create(TestAppModule, { logger: ["error"] });
    await app.listen(0);
    url = new URL("/mcp", await app.getUrl());
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await closeDatabase();
    if (previousEnforced === undefined) delete process.env.SOONWHY_AI_QUOTA_ENFORCED;
    else process.env.SOONWHY_AI_QUOTA_ENFORCED = previousEnforced;
  });

  beforeEach(async () => {
    await resetDatabase();
    const organization = await createOrganization();
    const project = await createProject(organization!.id);
    principal = { orgId: organization!.id, projectId: project!.id, scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] };
    const at = new Date();
    const base = {
      orgId: organization!.id,
      projectId: project!.id,
      serviceName: "api",
      type: "error_group",
      severity: "critical",
      title: "TypeError: boom",
      description: "Error group",
      observedValue: 12,
      threshold: 1,
      unit: "errors",
      windowStart: at,
      windowEnd: at,
      evidence: [
        { kind: "metric", label: "Occurrences", value: 12, context: { traceCount: 3 } },
        { kind: "log", label: "Latest occurrence", value: "boom" },
      ],
    } as const;
    first = (await upsertFinding({ ...base, fingerprint: "error:a" }, at))!.id;
    second = (await upsertFinding({ ...base, fingerprint: "error:b" }, at))!.id;

    await billing.setOrgQuota({ orgId: organization!.id, metric: "rca_invocations", limit: 1, unit: "invocations" });
    for (const fn of Object.values(llm)) fn.mockReset();
    llm.describe.mockResolvedValue({ source: "platform", provider: "groq", model: "m" });
    llm.analyzeEvidence.mockImplementation(async (_org: string, evidence: object) => ({
      analysis: { summary: "s", rootCause: "Unhandled null.", contributingFactors: [], investigationSteps: ["Read the stack."], suggestedChanges: ["Guard it."], evidenceRefs: [], confidence: "medium", limitations: [] },
      usage: { requestDurationMs: 5, retries: 0, totalTokens: 100 },
      promptVersion: "v-test",
      credential: { source: "platform", providerId: "groq", model: "m", credentialId: null },
      evidence: { serviceName: "api", severity: "critical", ...evidence },
    }));
  });

  async function connect(): Promise<Client> {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: "Bearer any" } } }));
    return client;
  }

  it("allows analyses up to the limit, then refuses the next one without calling the model", async () => {
    const client = await connect();
    const allowed = await client.callTool({ name: "request_rca", arguments: { findingId: first } });
    expect(allowed.isError, JSON.stringify(allowed.content)).not.toBe(true);
    expect(llm.analyzeEvidence).toHaveBeenCalledTimes(1);

    const refused = await client.callTool({ name: "request_rca", arguments: { findingId: second } });
    expect(refused.isError).toBe(true);
    expect(llm.analyzeEvidence).toHaveBeenCalledTimes(1);
    expect(await db.select().from(rcaAnalyses)).toHaveLength(1);

    const events = await billingRepository.getRecentBillingEvents(principal.orgId);
    expect(events.some((event) => event.type === "quota_exceeded" && event.metric === "rca_invocations")).toBe(true);
    await client.close();
  });

  it("still returns the stored analysis once the limit is reached", async () => {
    const client = await connect();
    await client.callTool({ name: "request_rca", arguments: { findingId: first } });
    const again = await client.callTool({ name: "request_rca", arguments: { findingId: first } });
    expect(again.isError).not.toBe(true);
    expect(JSON.stringify(again.content)).toContain("Unhandled null.");
    expect(llm.analyzeEvidence).toHaveBeenCalledTimes(1);
    await client.close();
  });
});
