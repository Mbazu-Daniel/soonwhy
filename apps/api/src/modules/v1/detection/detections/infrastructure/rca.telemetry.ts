import type { TracesService } from "../../../telemetry/traces/application/traces.service";
import type { RankingTelemetry, SpanRecord } from "../root-cause/root-cause.inputs.types";

export class TraceRankingTelemetry implements RankingTelemetry {
  constructor(private readonly traces: Pick<TracesService, "getTrace">) {}

  async loadTraces(orgId: string, projectId: string, traceIds: string[]): Promise<SpanRecord[][]> {
    const settled = await Promise.allSettled(traceIds.map((id) => this.traces.getTrace(orgId, projectId, id)));
    return settled.flatMap((result) => (result.status === "fulfilled" ? [result.value.spans as SpanRecord[]] : []));
  }
}
