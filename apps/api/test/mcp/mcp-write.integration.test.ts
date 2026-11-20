import "reflect-metadata";
import { ForbiddenException, Module, UnauthorizedException, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { MCP_ACTIONS_PORT, MCP_AUTHENTICATOR, MCP_ERRORS_PORT, MCP_FINDINGS_PORT, MCP_HOST_TOKENS, MCP_RCA_PORT, MCP_READ_SCOPE, MCP_TELEMETRY_PORT, MCP_WRITE_SCOPE, SoonwhyMcpModule } from "@soonwhy/mcp";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/common/db";
import { findings } from "../../src/common/db/schema";
import { RcaApiService } from "../../src/modules/v1/detection/detections/application/rca.api";
import { FindingsService } from "../../src/modules/v1/detection/findings/application/findings.service";
import { FindingRepository } from "../../src/modules/v1/detection/findings/infrastructure/finding.repository";
import { upsertFinding } from "../../src/modules/v1/detection/findings/infrastructure/finding-upsert";
import { McpActionsAdapter } from "../../src/modules/v1/investigation/mcp/mcp-actions.adapter";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

const rca = { generate: vi.fn() };
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
    { provide: FindingsService, useFactory: () => new FindingsService(new FindingRepository()) },
    McpActionsAdapter,
    { provide: RcaApiService, useValue: rca },
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

describe.skipIf(!databaseTestsEnabled)("MCP write tools against the database", () => {
  let app: INestApplication;
  let url: URL;
  let findingId: string;
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
      type: "latency",
      severity: "warning",
      title: "Slow",
      description: "Slow",
      observedValue: 900,
      threshold: 500,
      unit: "ms",
      windowStart: at,
      windowEnd: at,
      evidence: [],
    } as const;
    findingId = (await upsertFinding({ ...base, projectId: project!.id, fingerprint: "latency:api:" }, at))!.id;
    otherProjectFindingId = (await upsertFinding({ ...base, projectId: otherProject!.id, fingerprint: "latency:api:" }, at))!.id;
    principals = {
      reader: { orgId: organization!.id, projectId: project!.id, scopes: [MCP_READ_SCOPE] },
      writer: { orgId: organization!.id, projectId: project!.id, scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] },
    };
    rca.generate.mockReset();
  });

  async function connect(token: string): Promise<Client> {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
    return client;
  }

  const statusOf = async (id: string) => (await db.select().from(findings).where(eq(findings.id, id)))[0]!;

  it("resolves a finding in the database, and reopening clears the resolution", async () => {
    const client = await connect("writer");
    const resolved = await client.callTool({ name: "set_finding_status", arguments: { findingId, status: "resolved" } });
    expect(resolved.isError, JSON.stringify(resolved.content)).not.toBe(true);
    expect(await statusOf(findingId)).toMatchObject({ status: "resolved", resolvedBy: null });
    expect((await statusOf(findingId)).resolvedAt).toBeInstanceOf(Date);

    await client.callTool({ name: "set_finding_status", arguments: { findingId, status: "open" } });
    expect(await statusOf(findingId)).toMatchObject({ status: "open", resolvedAt: null });
    await client.close();
  });

  it("is idempotent: resolving twice leaves one resolved finding", async () => {
    const client = await connect("writer");
    await client.callTool({ name: "set_finding_status", arguments: { findingId, status: "ignored" } });
    const again = await client.callTool({ name: "set_finding_status", arguments: { findingId, status: "ignored" } });
    expect(again.isError).not.toBe(true);
    expect((await statusOf(findingId)).status).toBe("ignored");
    await client.close();
  });

  it("changes nothing for a read-only key", async () => {
    const client = await connect("reader");
    const result = await client.callTool({ name: "set_finding_status", arguments: { findingId, status: "resolved" } });
    expect(result.isError).toBe(true);
    expect((await statusOf(findingId)).status).toBe("open");
    await client.close();
  });

  it("cannot touch a finding in another project, even in the same organisation", async () => {
    const client = await connect("writer");
    const result = await client.callTool({ name: "set_finding_status", arguments: { findingId: otherProjectFindingId, status: "resolved" } });
    expect(result.isError).toBe(true);
    expect((await statusOf(otherProjectFindingId)).status).toBe("open");
    await client.close();
  });

  it("asks for an RCA without regeneration, scoped to the key's project", async () => {
    rca.generate.mockResolvedValue({ rootCause: "pool exhaustion" });
    const client = await connect("writer");
    await client.callTool({ name: "request_rca", arguments: { findingId } });
    expect(rca.generate).toHaveBeenCalledWith(principals.writer!.orgId, principals.writer!.projectId, findingId, false);
    await client.close();
  });
});
