import { Inject, Injectable } from "@nestjs/common";
import { Tool, type McpContext } from "@nestjs/mcp";
import type { z } from "zod";
import { MCP_ERRORS_PORT } from "../domain/mcp.tokens";
import { principalOf } from "../domain/mcp-principal";
import type { McpAuthedRequest, McpErrorsPort } from "../domain/mcp.types";
import { getErrorGroupSchema, listErrorGroupsSchema } from "../domain/mcp-tool.schemas";

@Injectable()
export class McpErrorsTools {
  constructor(@Inject(MCP_ERRORS_PORT) private readonly errors: McpErrorsPort) {}

  @Tool({
    name: "list_error_groups",
    description:
      "List grouped errors (same error type and message share a fingerprint) in this project, newest first, with counts. Use this first to find what is failing. Does not include stack traces; call get_error_group for those.",
    inputSchema: listErrorGroupsSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  })
  list(args: z.infer<typeof listErrorGroupsSchema>, ctx: McpContext<McpAuthedRequest>) {
    return this.errors.listGroups(principalOf(ctx), args);
  }

  @Tool({
    name: "get_error_group",
    description:
      "Get one error group in detail: its stack trace (application frames first, plus the cause chain), the latest occurrences with trace ids, and an occurrence timeline. Use the latest trace id with get_trace and list_logs to see what led to it.",
    inputSchema: getErrorGroupSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  })
  get(args: z.infer<typeof getErrorGroupSchema>, ctx: McpContext<McpAuthedRequest>) {
    return this.errors.getGroup(principalOf(ctx), args);
  }
}
