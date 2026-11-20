import { Inject, Injectable } from "@nestjs/common";
import { Tool, type McpContext } from "@nestjs/mcp";
import type { z } from "zod";
import { MCP_ACTIONS_PORT } from "../domain/mcp.tokens";
import { writerOf } from "../domain/mcp-principal";
import type { McpActionsPort, McpAuthedRequest } from "../domain/mcp.types";
import { requestRcaSchema, setFindingStatusSchema } from "../domain/mcp-tool.schemas";

@Injectable()
export class McpActionsTools {
  constructor(@Inject(MCP_ACTIONS_PORT) private readonly actions: McpActionsPort) {}

  @Tool({
    name: "set_finding_status",
    description:
      "Change a finding's status to open, resolved or ignored. Only call this when the user asked for it. Setting the status it already has changes nothing. Requires the mcp:write scope.",
    inputSchema: setFindingStatusSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  })
  setFindingStatus(args: z.infer<typeof setFindingStatusSchema>, ctx: McpContext<McpAuthedRequest>) {
    return this.actions.setFindingStatus(writerOf(ctx), args);
  }

  @Tool({
    name: "request_rca",
    description:
      "Generate a root cause analysis for a finding if none exists yet, and return it. If one exists it is returned as is, never regenerated. Generating uses the organisation's AI quota. Requires the mcp:write scope.",
    inputSchema: requestRcaSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  })
  requestRca(args: z.infer<typeof requestRcaSchema>, ctx: McpContext<McpAuthedRequest>) {
    return this.actions.requestRca(writerOf(ctx), args);
  }
}
