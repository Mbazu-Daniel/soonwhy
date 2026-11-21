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
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

const llm = { describe: vi.fn(), analyzeEvidence: vi.fn(), analyze: vi.fn() };
const billing = { assertQuota: vi.fn(), recordUsage: vi.fn() };
const unused = {};
let principals: Record<string, { orgId: string; projectId: string; scopes: string[] }> = {};

const authenticator = {
  authenticate: async (authorization: string | undefined, options: { scope: string }) => {
    const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? "")?.[1];
    const principal = token ? principals[token] : undefined;
    if (!principal) throw new UnauthorizedException("Invalid API key");
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
          llm as never,
          new RcaPersistenceService(new RcaAnalysisRepository()),
          new DatabaseRcaGovernanceSink(),
          billing as never,
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

describe.skipIf(!databaseTestsEnabled)("MCP request_rca against the database", () => {
  let app: INestApplication;
  let url: URL;
  let errorFindingId: string;
  let latencyFindingId: string;
  let otherProjectFindingId: string;

  beforeAll(async () => {
    app = await NestFactory.create(TestAppModule, { logger: ["error"] });
    await app.listen(0);
    url = new URL("/mcp", await app.getUrl());
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await closeDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    const organization = await createOrganization();
    const project = await createProject(organization!.id);
    const otherProject = await createProject(organization!.id);
    const at = new Date("2026-05-01T12:00:00.000Z");
    const base = {
      orgId: organization!.id,
      serviceName: "api",
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
    errorFindingId = (await upsertFinding({ ...base, projectId: project!.id, type: "error_group", fingerprint: "error:a" }, at))!.id;
    latencyFindingId = (await upsertFinding({ ...base, projectId: project!.id, type: "latency", evidence: [], fingerprint: "latency:a" }, at))!.id;
    otherProjectFindingId = (await upsertFinding({ ...base, projectId: otherProject!.id, type: "error_group", fingerprint: "error:b" }, at))!.id;
    principals = { writer: { orgId: organization!.id, projectId: project!.id, scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] } };

    for (const fn of [...Object.values(llm), ...Object.values(billing)]) fn.mockReset();
    llm.describe.mockResolvedValue({ source: "byok", provider: "groq", model: "m" });
    billing.assertQuota.mockResolvedValue(undefined);
    billing.recordUsage.mockResolvedValue({ id: "usage_1" });
    llm.analyzeEvidence.mockImplementation(async (_org: string, evidence: { items?: unknown[] }) => ({
      analysis: {
        summary: "Errors spiked.",
        rootCause: "Unhandled null in handler.",
        contributingFactors: [],
        investigationSteps: ["Read the stack."],
        suggestedChanges: ["Guard the null."],
        evidenceRefs: [],
        confidence: "medium",
        limitations: [],
      },
      usage: { requestDurationMs: 5, retries: 0, totalTokens: 100 },
      promptVersion: "v-test",
      credential: { source: "byok", providerId: "groq", model: "m", credentialId: "cred_1" },
      evidence: { serviceName: "api", severity: "critical", ...evidence },
    }));
  });

  async function connect(token: string): Promise<Client> {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
    return client;
  }

  const rcaRows = () => db.select().from(rcaAnalyses);

  it("generates and stores an RCA for an error finding, and meters the usage", async () => {
    const client = await connect("writer");
    const result = await client.callTool({ name: "request_rca", arguments: { findingId: errorFindingId } });
    expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
    expect(JSON.stringify(result.content)).toContain("Unhandled null in handler.");
    const rows = await rcaRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ findingId: errorFindingId, projectId: principals.writer!.projectId, trigger: "manual" });
    expect(billing.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ metric: "rca_invocations", quantity: 1 }));
    await client.close();
  });

  it("returns the stored RCA on a repeat call without calling the model again", async () => {
    const client = await connect("writer");
    await client.callTool({ name: "request_rca", arguments: { findingId: errorFindingId } });
    const again = await client.callTool({ name: "request_rca", arguments: { findingId: errorFindingId } });
    expect(again.isError).not.toBe(true);
    expect(llm.analyzeEvidence).toHaveBeenCalledTimes(1);
    expect(await rcaRows()).toHaveLength(1);
    await client.close();
  });

  it("stores nothing when the model fails, and a later call can succeed", async () => {
    llm.analyzeEvidence.mockRejectedValueOnce(new Error("provider down"));
    const client = await connect("writer");
    const failed = await client.callTool({ name: "request_rca", arguments: { findingId: errorFindingId } });
    expect(failed.isError).toBe(true);
    expect(JSON.stringify(failed.content)).not.toContain("provider down");
    expect(await rcaRows()).toHaveLength(0);
    const retried = await client.callTool({ name: "request_rca", arguments: { findingId: errorFindingId } });
    expect(retried.isError).not.toBe(true);
    expect(await rcaRows()).toHaveLength(1);
    await client.close();
  });

  it("refuses a finding type RCA does not support, without calling the model", async () => {
    const client = await connect("writer");
    const result = await client.callTool({ name: "request_rca", arguments: { findingId: latencyFindingId } });
    expect(result.isError).toBe(true);
    expect(llm.analyzeEvidence).not.toHaveBeenCalled();
    expect(await rcaRows()).toHaveLength(0);
    await client.close();
  });

  it("refuses a finding in another project of the same organisation", async () => {
    const client = await connect("writer");
    const result = await client.callTool({ name: "request_rca", arguments: { findingId: otherProjectFindingId } });
    expect(result.isError).toBe(true);
    expect(llm.analyzeEvidence).not.toHaveBeenCalled();
    expect(await rcaRows()).toHaveLength(0);
    await client.close();
  });
});
