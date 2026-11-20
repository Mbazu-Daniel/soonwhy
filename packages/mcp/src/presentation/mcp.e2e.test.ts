import "reflect-metadata";
import { ForbiddenException, Module, UnauthorizedException, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE } from "../domain/mcp.constants";
import { MCP_ACTIONS_PORT, MCP_AUTHENTICATOR, MCP_ERRORS_PORT, MCP_FINDINGS_PORT, MCP_HOST_TOKENS, MCP_RCA_PORT, MCP_TELEMETRY_PORT } from "../domain/mcp.tokens";
import { SoonwhyMcpModule } from "../soonwhy-mcp.module";

const authenticator = {
  authenticate: vi.fn(async (authorization: string | undefined, options: { scope: string }) => {
    const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? "")?.[1];
    const scopes = token === "good" ? [MCP_READ_SCOPE] : token === "writer" ? [MCP_READ_SCOPE, MCP_WRITE_SCOPE] : token === "noscope" ? [] : undefined;
    if (!scopes) throw new UnauthorizedException("Invalid or expired API key");
    if (!scopes.includes(options.scope)) throw new ForbiddenException("scope");
    return { orgId: "org_1", projectId: "proj_1", scopes };
  }),
};
const errors = { listGroups: vi.fn(), getGroup: vi.fn() };
const telemetry = { listLogs: vi.fn(), listTraces: vi.fn(), getTrace: vi.fn() };
const findings = { list: vi.fn() };
const rca = { getLatest: vi.fn() };
const actions = { setFindingStatus: vi.fn(), requestRca: vi.fn() };

@Module({
  providers: [
    { provide: MCP_AUTHENTICATOR, useValue: authenticator },
    { provide: MCP_ERRORS_PORT, useValue: errors },
    { provide: MCP_TELEMETRY_PORT, useValue: telemetry },
    { provide: MCP_FINDINGS_PORT, useValue: findings },
    { provide: MCP_RCA_PORT, useValue: rca },
    { provide: MCP_ACTIONS_PORT, useValue: actions },
  ],
  exports: MCP_HOST_TOKENS,
})
class FakeHostModule {}

@Module({ imports: [SoonwhyMcpModule.register({ host: FakeHostModule })] })
class TestAppModule {}

describe("MCP server", () => {
  let app: INestApplication;
  let url: URL;

  beforeAll(async () => {
    app = await NestFactory.create(TestAppModule, { logger: ["error"] });
    await app.listen(0);
    url = new URL("/mcp", await app.getUrl());
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  async function connect(token: string): Promise<Client> {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
    return client;
  }

  it("rejects a request with an unknown key", async () => {
    await expect(connect("nope")).rejects.toThrow();
  });

  it("rejects a key without the mcp:read scope", async () => {
    await expect(connect("noscope")).rejects.toThrow();
  });

  it("lists the read tools and the two write tools, marking only the reads read-only", async () => {
    const client = await connect("good");
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "get_error_group",
      "get_rca",
      "get_trace",
      "list_error_groups",
      "list_findings",
      "list_logs",
      "list_traces",
      "request_rca",
      "set_finding_status",
    ]);
    const writes = tools.filter((tool) => tool.annotations?.readOnlyHint !== true).map((tool) => tool.name).sort();
    expect(writes).toEqual(["request_rca", "set_finding_status"]);
    expect(tools.filter((tool) => tool.annotations?.readOnlyHint !== true).every((tool) => tool.annotations?.destructiveHint === false)).toBe(true);
    await client.close();
  }, 30_000);

  it("passes the key's org and project, never tool arguments, to the host", async () => {
    errors.listGroups.mockResolvedValue({ status: "empty" });
    const client = await connect("good");
    const result = await client.callTool({ name: "list_error_groups", arguments: { hours: 2 } });
    expect(errors.listGroups).toHaveBeenCalledWith({ orgId: "org_1", projectId: "proj_1", scopes: [MCP_READ_SCOPE] }, expect.objectContaining({ hours: 2, limit: 20 }));
    expect(JSON.stringify(result.content)).toContain("empty");
    await client.close();
  }, 30_000);

  it("refuses arguments outside the schema before reaching the host", async () => {
    telemetry.listLogs.mockClear();
    const client = await connect("good");
    const result = await client.callTool({ name: "list_logs", arguments: { hours: 9999 } });
    expect(result.isError).toBe(true);
    expect(telemetry.listLogs).not.toHaveBeenCalled();
    await client.close();
  }, 30_000);

  it("returns the host's result for an existing RCA", async () => {
    rca.getLatest.mockResolvedValueOnce({ status: "available", data: { rootCause: "pool exhaustion" } });
    const client = await connect("good");
    const found = await client.callTool({ name: "get_rca", arguments: { findingId: "f1" } });
    expect(JSON.stringify(found.content)).toContain("pool exhaustion");
    await client.close();
  }, 30_000);

  it("refuses a write call from a read-only key without reaching the host", async () => {
    actions.setFindingStatus.mockClear();
    const client = await connect("good");
    const result = await client.callTool({ name: "set_finding_status", arguments: { findingId: "f1", status: "resolved" } });
    expect(result.isError).toBe(true);
    expect(actions.setFindingStatus).not.toHaveBeenCalled();
    await client.close();
  }, 30_000);

  it("runs a write call for a key with mcp:write, scoped to its project", async () => {
    actions.setFindingStatus.mockResolvedValue({ id: "f1", status: "resolved" });
    const client = await connect("writer");
    const result = await client.callTool({ name: "set_finding_status", arguments: { findingId: "f1", status: "resolved" } });
    expect(result.isError).not.toBe(true);
    expect(actions.setFindingStatus).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org_1", projectId: "proj_1" }), { findingId: "f1", status: "resolved" });
    await client.close();
  }, 30_000);

  it("rejects a status outside open, resolved and ignored", async () => {
    actions.setFindingStatus.mockClear();
    const client = await connect("writer");
    const result = await client.callTool({ name: "set_finding_status", arguments: { findingId: "f1", status: "deleted" } });
    expect(result.isError).toBe(true);
    expect(actions.setFindingStatus).not.toHaveBeenCalled();
    await client.close();
  }, 30_000);

  it("requests an RCA through the host for a writer", async () => {
    actions.requestRca.mockResolvedValue({ rootCause: "pool exhaustion" });
    const client = await connect("writer");
    const result = await client.callTool({ name: "request_rca", arguments: { findingId: "f1" } });
    expect(JSON.stringify(result.content)).toContain("pool exhaustion");
    await client.close();
  }, 30_000);
});
