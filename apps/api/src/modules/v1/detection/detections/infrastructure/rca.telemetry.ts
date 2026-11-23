import { Logger } from "@nestjs/common";
import { recordRcaTraceLoad } from "../../../../../common/telemetry/otel-metrics";
import type { RankingTelemetry, SpanRecord, TraceLoad, TraceSource } from "../root-cause/root-cause.inputs.types";

export class TraceRankingTelemetry implements RankingTelemetry {
  private static readonly logger = new Logger(TraceRankingTelemetry.name);

  constructor(private readonly traces: TraceSource) {}

  async loadTraces(orgId: string, projectId: string, traceIds: string[]): Promise<TraceLoad> {
    const settled = await Promise.allSettled(traceIds.map((id) => this.traces.getTrace(orgId, projectId, id)));
    const load: TraceLoad = { traces: [], failed: [], notFound: [], requested: traceIds.length };

    settled.forEach((result, index) => {
      const id = traceIds[index]!;
      if (result.status === "rejected") {
        load.failed.push(id);
        TraceRankingTelemetry.logger.warn(
          `Trace ${id} could not be loaded for ranking: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        );
        return;
      }
      const spans = result.value.spans as SpanRecord[];
      if (spans.length === 0) load.notFound.push(id);
      else load.traces.push(spans);
    });

    recordRcaTraceLoad({ loaded: load.traces.length, failed: load.failed.length, notFound: load.notFound.length });
    return load;
  }
}
