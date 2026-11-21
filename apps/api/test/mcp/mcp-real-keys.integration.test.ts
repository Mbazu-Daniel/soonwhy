import "reflect-metadata";
import { Module, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { MCP_ACTIONS_PORT, MCP_AUTHENTICATOR, MCP_ERRORS_PORT, MCP_FINDINGS_PORT, MCP_HOST_TOKENS, MCP_RCA_PORT, MCP_TELEMETRY_PORT, SoonwhyMcpModule } from "@soonwhy/mcp";
import { ApiKeyAuthenticator } from "@soonwhy/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/common/db";
import { findings } from "../../src/common/db/schema";
import { RcaApiService } from "../../src/modules/v1/detection/detections/application/rca.api";
import { FindingsService } from "../../src/modules/v1/detection/findings/application/findings.service";
import { FindingRepository } from "../../src/modules/v1/detection/findings/infrastructure/finding.repository";
import { upsertFinding } from "../../src/modules/v1/detection/findings/infrastructure/finding-upsert";
import { ApiKeysRepository } from "../../src/modules/v1/identity/api-keys/infrastructure/api-keys.repository";
import { McpActionsAdapter } from "../../src/modules/v1/investigation/mcp/mcp-actions.adapter";
import { McpApiKeyAuthenticator } from "../../src/modules/v1/investigation/mcp/mcp-api-key.authenticator";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

const rca = { generate: vi.fn() };
const unused = {};

@Module({
  providers: [
    McpActionsAdapter,
    { provide: FindingsService, useFactory: () => new FindingsService(new FindingRepository()) },
    { provide: RcaApiService, useValue: rca },
    { provide: MCP_AUTHENTICATOR, useFactory: () => new McpApiKeyAuthenticator(new ApiKeyAuthenticator(db as never)) },
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

describe.skipIf(!databaseTestsEnabled)("MCP with real API keys", () => {
  let app: INestApplication;
  let url: URL;
  let findingId: string;
  let projectId: string;
  const keys: Record<string, string> = {};

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
    projectId = project!.id;
    const otherProject = await createProject(organization!.id);
    const at = new Date("2026-05-01T12:00:00.000Z");
    findingId = (
      await upsertFinding(
        { orgId: organization!.id, projectId, serviceName: "api", type: "latency", severity: "warning", title: "Slow", description: "Slow", observedValue: 900, threshold: 500, unit: "ms", windowStart: at, windowEnd: at, evidence: [], fingerprint: "latency:api:" },
        at,
      )
    )!.id;
    const repository = new ApiKeysRepository();
    keys.ingest = (await repository.createApiKey({ projectId, name: "ingest", scopes: [] })).key;
    keys.reader = (await repository.createApiKey({ projectId, name: "reader", scopes: ["mcp:read"] })).key;
    keys.writer = (await repository.createApiKey({ projectId, name: "writer", scopes: ["mcp:read", "mcp:write"] })).key;
    keys.expired = (await repository.createApiKey({ projectId, name: "old", scopes: ["mcp:read", "mcp:write"], expiresAt: new Date(Date.now() - 1000) })).key;
    keys.otherProject = (await repository.createApiKey({ projectId: otherProject!.id, name: "other", scopes: ["mcp:read", "mcp:write"] })).key;
  });

  async function connect(key: string): Promise<Client> {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${key}` } } }));
    return client;
  }

  const statusOf = async () => (await db.select().from(findings).where(eq(findings.id, findingId)))[0]!.status;

  it("lets a writer key change a finding in its own project", async () => {
    const client = await connect(keys.writer!);
    const result = await client.callTool({ name: "set_finding_status", arguments: { findingId, status: "resolved" } });
    expect(result.isError).not.toBe(true);
    expect(await statusOf()).toBe("resolved");
    await client.close();
  });

  it("lets a reader key connect but not change anything", async () => {
    const client = await connect(keys.reader!);
    expect((await client.listTools()).tools.length).toBeGreaterThan(0);
    const result = await client.callTool({ name: "set_finding_status", arguments: { findingId, status: "resolved" } });
    expect(result.isError).toBe(true);
    expect(await statusOf()).toBe("open");
    await client.close();
  });

  it("rejects an ingestion key, an expired key and a made-up key at connect", async () => {
    await expect(connect(keys.ingest!)).rejects.toThrow();
    await expect(connect(keys.expired!)).rejects.toThrow();
    await expect(connect("soonwhy_not_a_real_key")).rejects.toThrow();
  });

  it("does not let another project's writer key touch this project's finding", async () => {
    const client = await connect(keys.otherProject!);
    const result = await client.callTool({ name: "set_finding_status", arguments: { findingId, status: "resolved" } });
    expect(result.isError).toBe(true);
    expect(await statusOf()).toBe("open");
    await client.close();
  });
});
