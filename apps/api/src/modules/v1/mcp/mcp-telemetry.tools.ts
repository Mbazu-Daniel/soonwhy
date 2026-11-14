import { Inject, Injectable } from "@nestjs/common";
import { Tool, type McpContext } from "@nestjs/mcp";
import type { z } from "zod4";
import { getTraceSchema, listLogsSchema, listTracesSchema } from "../investigation-tools/investigation-tools.schemas";
import { TelemetryInvestigation } from "../investigation-tools/telemetry-investigation.service";
import { principalOf } from "./mcp-principal";
import type { McpAuthedRequest } from "./mcp.types";

@Injectable()
export class McpTelemetryTools {
  constructor(@Inject(TelemetryInvestigation) private readonly telemetry: TelemetryInvestigation) {}

  @Tool({
    name: "list_logs",
    description:
      "Search logs in this project, newest first. Filter by traceId to see everything logged during one request, by level, service, or message text.",
    inputSchema: listLogsSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  })
  listLogs(args: z.infer<typeof listLogsSchema>, ctx: McpContext<McpAuthedRequest>) {
    return this.telemetry.listLogs(principalOf(ctx), args);
  }

  @Tool({
    name: "list_traces",
    description: "List recent traces in this project with their root operation and duration. Use get_trace for the spans of one.",
    inputSchema: listTracesSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  })
  listTraces(args: z.infer<typeof listTracesSchema>, ctx: McpContext<McpAuthedRequest>) {
    return this.telemetry.listTraces(principalOf(ctx), args);
  }

  @Tool({
    name: "get_trace",
    description:
      "Get the spans of one trace, in time order. Overlapping spans run concurrently, so do not add their durations together.",
    inputSchema: getTraceSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  })
  getTrace(args: z.infer<typeof getTraceSchema>, ctx: McpContext<McpAuthedRequest>) {
    return this.telemetry.getTrace(principalOf(ctx), args);
  }
}
