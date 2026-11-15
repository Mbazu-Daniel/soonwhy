import "reflect-metadata";
import { Module, UseGuards, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { McpModule } from "@nestjs/mcp";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiKeyAuthenticator } from "@soonwhy/shared";
import { DetectionService } from "../detections/detection.service";
import { ErrorsService } from "../errors/errors.service";
import { LogsService } from "../logs/logs.service";
import { TracesService } from "../traces/traces.service";
import { McpApiKeyGuard } from "./mcp-api-key.guard";
import { ErrorsInvestigation } from "../investigation-tools/errors-investigation.service";
import { FindingsInvestigation } from "../investigation-tools/findings-investigation.service";
import { RcaInvestigation } from "../investigation-tools/rca-investigation.service";
import { RcaApiService } from "../detections/rca.api";
import { TelemetryInvestigation } from "../investigation-tools/telemetry-investigation.service";
import { McpErrorsTools } from "./mcp-errors.tools";
import { McpFindingsTools } from "./mcp-findings.tools";
import { McpTelemetryTools } from "./mcp-telemetry.tools";
import { MCP_READ_SCOPE } from "./mcp.constants";

const STACK = "Error: boom\n    at Handler.run (/app/src/handler.ts:10:5)\n    at /app/node_modules/express/lib/layer.js:1:1";

const apiKeys = {
  authenticate: vi.fn(async (authorization: string | undefined, options: { scope?: string } = {}) => {
    const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? "")?.[1];
    const scopes = token === "good" ? [MCP_READ_SCOPE] : token === "noscope" ? [] : undefined;
    if (!scopes) return { ok: false, reason: "invalid", message: "Invalid or expired API key" };
    if (options.scope && !scopes.includes(options.scope)) return { ok: false, reason: "scope", message: "scope" };
    return { ok: true, key: { organizationId: "org_1", projectId: "proj_1", scopes } };
  }),
};
const errors = {
  listGroups: vi.fn(),
  getGroup: vi.fn(),
};
const logs = { getLogs: vi.fn() };
const traces = { listTraces: vi.fn(), getTrace: vi.fn() };
const detections = { list: vi.fn() };
const rcaApi = { getLatest: vi.fn() };

@Module({ providers: [{ provide: ApiKeyAuthenticator, useValue: apiKeys }], exports: [ApiKeyAuthenticator] })
class FakeApiKeysModule {}

@Module({
  imports: [
    McpModule.forRoot({
      name: "test",
      version: "0.0.0",
      decorators: [UseGuards(McpApiKeyGuard)],
      imports: [FakeApiKeysModule],
    }),
  ],
  providers: [
    McpApiKeyGuard,
    McpErrorsTools,
    McpTelemetryTools,
    McpFindingsTools,
    ErrorsInvestigation,
    TelemetryInvestigation,
    FindingsInvestigation,
    RcaInvestigation,
    { provide: RcaApiService, useValue: rcaApi },
    { provide: ErrorsService, useValue: errors },
    { provide: LogsService, useValue: logs },
    { provide: TracesService, useValue: traces },
    { provide: DetectionService, useValue: detections },
    { provide: ApiKeyAuthenticator, useValue: apiKeys },
  ],
})
class TestMcpModule {}

describe("MCP server", () => {
  let app: INestApplication;
  let url: URL;

  beforeAll(async () => {
    app = await NestFactory.create(TestMcpModule, { logger: ["error"] });
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

  it("rejects a request with no or an unknown key", async () => {
    await expect(connect("nope")).rejects.toThrow();
  });

  it("rejects a key without the mcp:read scope", async () => {
    await expect(connect("noscope")).rejects.toThrow();
  });

  it("exposes only read-only tools", async () => {
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
    ]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    await client.close();
  }, 30_000);

  it("scopes queries to the key's org and project", async () => {
    errors.listGroups.mockResolvedValue([]);
    const client = await connect("good");
    const result = await client.callTool({ name: "list_error_groups", arguments: { hours: 2 } });
    expect(errors.listGroups).toHaveBeenCalledWith("org_1", "proj_1", expect.objectContaining({ limit: 20 }));
    expect(JSON.stringify(result.content)).toContain("empty");
    await client.close();
  }, 30_000);

  it("returns stack frames and causes for an error group", async () => {
    errors.getGroup.mockResolvedValue({
      fingerprint: "abc", errorType: "Error", errorMessage: "boom", service: "api", level: "error",
      count: 3, traceCount: 2, firstSeen: "a", lastSeen: "b", traceId: "t1", spanId: "s1", logId: "l1",
      exception: STACK, occurrences: [], timeline: [],
    });
    const client = await connect("good");
    const result = await client.callTool({ name: "get_error_group", arguments: { fingerprint: "abc" } });
    const text = JSON.stringify(result.content);
    expect(text).toContain("available");
    expect(text).toContain("Handler.run");
    expect(text).not.toContain("express/lib/layer.js:1:1\\\"]");
    await client.close();
  }, 30_000);

  it("reports a failed query as unavailable, not empty", async () => {
    logs.getLogs.mockRejectedValue(new Error("quickwit down"));
    const client = await connect("good");
    const result = await client.callTool({ name: "list_logs", arguments: {} });
    const text = JSON.stringify(result.content);
    expect(text).toContain("unavailable");
    expect(text).not.toContain("quickwit down");
    await client.close();
  }, 30_000);

  it("returns an existing RCA, and says so when there is none", async () => {
    const client = await connect("good");
    rcaApi.getLatest.mockResolvedValueOnce({
      findingId: "f1", serviceName: "api", severity: "critical", summary: "s", rootCause: "pool exhaustion",
      contributingFactors: [], investigationSteps: [], suggestedChanges: [], limitations: [], confidence: "medium",
      model: "m", createdAt: new Date("2026-11-14T00:00:00Z"),
    });
    const found = await client.callTool({ name: "get_rca", arguments: { findingId: "f1" } });
    expect(JSON.stringify(found.content)).toContain("pool exhaustion");
    expect(rcaApi.getLatest).toHaveBeenCalledWith("org_1", "proj_1", "f1");

    rcaApi.getLatest.mockResolvedValueOnce(undefined);
    const none = await client.callTool({ name: "get_rca", arguments: { findingId: "f2" } });
    expect(JSON.stringify(none.content)).toContain("empty");
    await client.close();
  }, 30_000);
});
