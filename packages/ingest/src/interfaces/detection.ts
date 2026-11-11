export type DetectionEventKind =
  | "run_started"
  | "finding"
  | "run_completed"
  | "run_failed";

/**
 * Compact detection telemetry published by the API and indexed in Quickwit.
 * Evidence payloads stay in Postgres; this record carries searchable metadata.
 */
export type ParsedDetectionEvent = Record<string, unknown> & {
  eventId?: string;
  kind?: DetectionEventKind | string;
  detector?: string;
  findingId?: string;
  runId?: string;
  service?: string;
  serviceName?: string;
  type?: string;
  severity?: string;
  title?: string;
  observedValue?: number;
  threshold?: number;
  unit?: string;
  windowStart?: string;
  windowEnd?: string;
  timestamp?: string;
};
