import { Inject, Injectable } from "@nestjs/common";
import { Tool, type McpContext } from "@nestjs/mcp";
import type { z } from "zod";
import { MCP_FINDINGS_PORT, MCP_RCA_PORT } from "../domain/mcp.tokens";
import { principalOf } from "../domain/mcp-principal";
import type { McpAuthedRequest, McpFindingsPort, McpRcaPort } from "../domain/mcp.types";
import { getRcaSchema, listFindingsSchema } from "../domain/mcp-tool.schemas";

@Injectable()
export class McpFindingsTools {
  constructor(
    @Inject(MCP_FINDINGS_PORT) private readonly findings: McpFindingsPort,
    @Inject(MCP_RCA_PORT) private readonly rca: McpRcaPort,
  ) {}

  @Tool({
    name: "list_findings",
    description:
      "List findings Soonwhy has detected in this project (slow endpoints, database problems, error groups, saturation) with the evidence behind each. Start here to see what Soonwhy already considers wrong.",
    inputSchema: listFindingsSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  })
  list(args: z.infer<typeof listFindingsSchema>, ctx: McpContext<McpAuthedRequest>) {
    return this.findings.list(principalOf(ctx), args);
  }

  @Tool({
    name: "get_rca",
    description:
      "Get the latest root cause analysis Soonwhy generated for a finding, if there is one. It never creates one. The analysis is a model's hypothesis from detector evidence, so verify it against errors, logs and traces.",
    inputSchema: getRcaSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  })
  getRca(args: z.infer<typeof getRcaSchema>, ctx: McpContext<McpAuthedRequest>) {
    return this.rca.getLatest(principalOf(ctx), args);
  }
}
