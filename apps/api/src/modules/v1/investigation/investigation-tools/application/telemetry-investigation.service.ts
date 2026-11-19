import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod4";
import { LogsService } from "../../../telemetry/logs/application/logs.service";
import { TracesService } from "../../../telemetry/traces/application/traces.service";
import { clip } from "../domain/clip";
import { available, empty, gather, unavailable } from "../domain/evidence-result";
import { TOOL_MAX_SPANS } from "../domain/investigation-tools.constants";
import { getTraceSchema, listLogsSchema, listTracesSchema } from "../infrastructure/investigation-tools.schemas";
import type { ToolScope } from "../domain/investigation-tools.types";
import { rangeOf } from "../domain/range";

@Injectable()
export class TelemetryInvestigation {
  constructor(
    @Inject(LogsService) private readonly logs: LogsService,
    @Inject(TracesService) private readonly traces: TracesService,
  ) {}

  listLogs({ orgId, projectId }: ToolScope, args: z.infer<typeof listLogsSchema>) {
    const range = rangeOf(args.hours);
    return gather(async () => {
      const result = await this.logs.getLogs(orgId, {
        projectId,
        ...range,
        level: args.level ?? "all",
        service: args.service,
        traceId: args.traceId,
        q: args.query,
        limit: args.limit,
      });
      return {
        truncated: Boolean(result.nextCursor),
        items: result.data.map((log) => ({
          timestamp: log.timestamp,
          level: log.level,
          service: log.service,
          message: clip(log.message, 500),
          traceId: log.traceId || null,
          spanId: log.spanId || null,
          hasStackTrace: log.stackTrace.length > 0,
        })),
      };
    }, `No logs matched in the last ${args.hours} hours.`);
  }

  listTraces({ orgId, projectId }: ToolScope, args: z.infer<typeof listTracesSchema>) {
    const range = rangeOf(args.hours);
    return gather(async () => {
      const result = await this.traces.listTraces(orgId, { projectId, ...range, limit: args.limit, service: args.service, q: args.query });
      return { truncated: Boolean(result.nextCursor), items: result.data };
    }, `No traces in the last ${args.hours} hours.`);
  }

  async getTrace({ orgId, projectId }: ToolScope, args: z.infer<typeof getTraceSchema>) {
    try {
      const trace = await this.traces.getTrace(orgId, projectId, args.traceId);
      if (trace.spans.length === 0) {
        return empty<never>("No spans found for this trace id. It may be outside retention or still being ingested.");
      }
      return available(
        { traceId: trace.traceId, spanCount: trace.spans.length, spans: trace.spans.slice(0, TOOL_MAX_SPANS) },
        trace.spans.length > TOOL_MAX_SPANS,
      );
    } catch {
      return unavailable("The query failed. This is not the same as no results.");
    }
  }
}
