import { Inject, Injectable } from "@nestjs/common";
import { Tool, type McpContext } from "@nestjs/mcp";
import type { z } from "zod4";
import { FindingsInvestigation } from "../../investigation-tools/application/findings-investigation.service";
import { getRcaSchema, listFindingsSchema } from "../../investigation-tools/infrastructure/investigation-tools.schemas";
import { RcaInvestigation } from "../../investigation-tools/application/rca-investigation.service";
import { principalOf } from "../domain/mcp-principal";
import type { McpAuthedRequest } from "../domain/mcp.types";

@Injectable()
export class McpFindingsTools {
  constructor(
    @Inject(FindingsInvestigation) private readonly findings: FindingsInvestigation,
    @Inject(RcaInvestigation) private readonly rca: RcaInvestigation,
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
