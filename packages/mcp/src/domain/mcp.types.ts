import type { z } from "zod";
import type { MCP_PRINCIPAL_KEY } from "./mcp.constants";
import type {
  getErrorGroupSchema,
  getRcaSchema,
  getTraceSchema,
  listErrorGroupsSchema,
  listFindingsSchema,
  listLogsSchema,
  requestRcaSchema,
  setFindingStatusSchema,
  listTracesSchema,
} from "./mcp-tool.schemas";

export interface McpToolScope {
  orgId: string;
  projectId: string;
}

export interface McpPrincipal extends McpToolScope {
  scopes: string[];
}

export type McpAuthedRequest = {
  headers: Record<string, string | string[] | undefined>;
} & { [K in typeof MCP_PRINCIPAL_KEY]?: McpPrincipal };

export interface McpAuthenticator {
  authenticate(authorization: string | undefined, options: { scope: string }): Promise<McpPrincipal>;
}

export interface McpErrorsPort {
  listGroups(scope: McpToolScope, args: z.infer<typeof listErrorGroupsSchema>): unknown;
  getGroup(scope: McpToolScope, args: z.infer<typeof getErrorGroupSchema>): unknown;
}

export interface McpTelemetryPort {
  listLogs(scope: McpToolScope, args: z.infer<typeof listLogsSchema>): unknown;
  listTraces(scope: McpToolScope, args: z.infer<typeof listTracesSchema>): unknown;
  getTrace(scope: McpToolScope, args: z.infer<typeof getTraceSchema>): unknown;
}

export interface McpFindingsPort {
  list(scope: McpToolScope, args: z.infer<typeof listFindingsSchema>): unknown;
}

export interface McpRcaPort {
  getLatest(scope: McpToolScope, args: z.infer<typeof getRcaSchema>): unknown;
}

export interface McpActionsPort {
  setFindingStatus(scope: McpToolScope, args: z.infer<typeof setFindingStatusSchema>): unknown;
  requestRca(scope: McpToolScope, args: z.infer<typeof requestRcaSchema>): unknown;
}
