import { Inject, Injectable } from "@nestjs/common";
import type { McpActionsPort, McpToolScope, requestRcaSchema, setFindingStatusSchema } from "@soonwhy/mcp";
import type { z } from "zod4";
import { RcaApiService } from "../../detection/detections/application/rca.api";
import { FindingsService } from "../../detection/findings/application/findings.service";

@Injectable()
export class McpActionsAdapter implements McpActionsPort {
  constructor(
    @Inject(FindingsService) private readonly findings: FindingsService,
    @Inject(RcaApiService) private readonly rca: RcaApiService,
  ) {}

  setFindingStatus({ orgId, projectId }: McpToolScope, args: z.infer<typeof setFindingStatusSchema>) {
    return this.findings.setStatus(orgId, projectId, args.findingId, args.status, null);
  }

  requestRca({ orgId, projectId }: McpToolScope, args: z.infer<typeof requestRcaSchema>) {
    return this.rca.generate(orgId, projectId, args.findingId, false);
  }
}
