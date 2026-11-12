import type { DetectionEvidence } from "../../../common/db/schema/findings";

export interface TraceSpanLike {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyType: string;
  dependencyName: string;
  parentSpanId?: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
}

export function traceSpanPayload<S extends TraceSpanLike>(sample: S) {
  return {
    timestamp: sample.timestamp,
    service: sample.service,
    traceId: sample.traceId,
    spanId: sample.spanId,
    duration: sample.duration,
    dependencyType: sample.dependencyType,
    dependencyName: sample.dependencyName,
    ...(sample.dbQueryText ? { dbQueryText: sample.dbQueryText } : {}),
    ...(sample.dbQuerySummary ? { dbQuerySummary: sample.dbQuerySummary } : {}),
    ...(sample.dbOperationName ? { dbOperationName: sample.dbOperationName } : {}),
    ...(sample.dbSystemName ? { dbSystemName: sample.dbSystemName } : {}),
    ...(sample.dbCollectionName ? { dbCollectionName: sample.dbCollectionName } : {}),
  };
}

export function traceSpanEvidence(
  label: string,
  fingerprint: string | undefined,
  sample: TraceSpanLike,
  extraContext: Record<string, string | number | boolean | null | undefined> = {},
  value?: number | string,
): DetectionEvidence {
  return {
    kind: "trace",
    label,
    value: value ?? sample.duration,
    context: {
      service: sample.service,
      traceId: sample.traceId,
      spanId: sample.spanId,
      timestamp: sample.timestamp,
      ...(fingerprint ? { fingerprint } : {}),
      ...extraContext,
    },
  };
}
