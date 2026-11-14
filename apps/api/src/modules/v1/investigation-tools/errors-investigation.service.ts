import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod4";
import { ErrorsService } from "../errors/errors.service";
import { summarizeStack } from "../errors/stack-summary";
import { clip } from "./clip";
import { available, gather, unavailable } from "./evidence-result";
import { TOOL_OCCURRENCES_SHOWN } from "./investigation-tools.constants";
import { getErrorGroupSchema, listErrorGroupsSchema } from "./investigation-tools.schemas";
import type { ToolScope } from "./investigation-tools.types";
import { rangeOf } from "./range";

@Injectable()
export class ErrorsInvestigation {
  constructor(@Inject(ErrorsService) private readonly errors: ErrorsService) {}

  listGroups({ orgId, projectId }: ToolScope, args: z.infer<typeof listErrorGroupsSchema>) {
    const range = rangeOf(args.hours);
    return gather(async () => {
      const groups = await this.errors.listGroups(orgId, projectId, { ...range, service: args.service, limit: args.limit });
      return {
        truncated: groups.length >= args.limit,
        items: groups.map((group) => ({
          fingerprint: group.fingerprint,
          errorType: group.errorType,
          message: clip(group.errorMessage, 300),
          service: group.service,
          level: group.level,
          occurrences: group.count,
          traces: group.traceCount,
          firstSeen: group.firstSeen,
          lastSeen: group.lastSeen,
          latestTraceId: group.traceId || null,
          hasStackTrace: group.exception.length > 0,
        })),
      };
    }, `No errors in the last ${args.hours} hours.`);
  }

  async getGroup({ orgId, projectId }: ToolScope, args: z.infer<typeof getErrorGroupSchema>) {
    try {
      const group = await this.errors.getGroup(orgId, projectId, args.fingerprint, rangeOf(args.hours));
      const summary = summarizeStack(group.exception);
      return available({
        fingerprint: group.fingerprint,
        errorType: group.errorType,
        message: clip(group.errorMessage, 500),
        service: group.service,
        level: group.level,
        occurrences: group.count,
        traces: group.traceCount,
        firstSeen: group.firstSeen,
        lastSeen: group.lastSeen,
        stack: summary
          ? { exception: summary.header, applicationFrames: summary.applicationFrames, causes: summary.causes, raw: clip(group.exception) }
          : null,
        stackNote: summary ? null : "No stack trace was captured. HTTP status errors never carry one.",
        latestOccurrences: group.occurrences.slice(0, TOOL_OCCURRENCES_SHOWN).map((item) => ({
          timestamp: item.timestamp,
          traceId: item.traceId || null,
          spanId: item.spanId || null,
          message: clip(item.message, 300),
        })),
        timeline: group.timeline,
      });
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) {
        return unavailable(`No error group ${args.fingerprint} in the last ${args.hours} hours. Try a wider range.`);
      }
      return unavailable("The query failed. This is not the same as no results.");
    }
  }
}
