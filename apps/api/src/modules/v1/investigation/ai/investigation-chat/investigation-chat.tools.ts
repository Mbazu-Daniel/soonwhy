import { createTool } from "@mastra/core/tools";
import { getErrorGroupSchema, getRcaSchema, getTraceSchema, listErrorGroupsSchema, listFindingsSchema, listLogsSchema, listTracesSchema } from "../../investigation-tools/infrastructure/investigation-tools.schemas";
import type { ToolScope } from "../../investigation-tools/domain/investigation-tools.types";
import type { InvestigationServices } from "./investigation-chat.tools.types";

export function buildInvestigationTools(scope: ToolScope, services: InvestigationServices) {
  const { errors, telemetry, findings, rca } = services;
  return {
    list_findings: createTool({
      id: "list_findings",
      description: "List problems Soonwhy already detected in this project, with the evidence behind each. A good first look.",
      inputSchema: listFindingsSchema,
      execute: async (input) => findings.list(scope, input),
    }),
    get_rca: createTool({
      id: "get_rca",
      description: "The latest root cause analysis already generated for a finding, if any. It never creates one. It is a hypothesis, so verify it.",
      inputSchema: getRcaSchema,
      execute: async (input) => rca.getLatest(scope, input),
    }),
    list_error_groups: createTool({
      id: "list_error_groups",
      description: "List grouped errors in this project, newest first, with counts. No stack traces; use get_error_group for those.",
      inputSchema: listErrorGroupsSchema,
      execute: async (input) => errors.listGroups(scope, input),
    }),
    get_error_group: createTool({
      id: "get_error_group",
      description: "One error group in detail: application frames, cause chain, latest occurrences with trace ids, timeline.",
      inputSchema: getErrorGroupSchema,
      execute: async (input) => errors.getGroup(scope, input),
    }),
    list_logs: createTool({
      id: "list_logs",
      description: "Search logs, newest first. Filter by traceId to see everything logged during one request.",
      inputSchema: listLogsSchema,
      execute: async (input) => telemetry.listLogs(scope, input),
    }),
    list_traces: createTool({
      id: "list_traces",
      description: "List recent traces with root operation and duration.",
      inputSchema: listTracesSchema,
      execute: async (input) => telemetry.listTraces(scope, input),
    }),
    get_trace: createTool({
      id: "get_trace",
      description: "The spans of one trace in time order. Overlapping spans run concurrently.",
      inputSchema: getTraceSchema,
      execute: async (input) => telemetry.getTrace(scope, input),
    }),
  };
}
