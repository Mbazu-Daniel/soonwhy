import { QUICKWIT_WRITE_STATE, QuickwitIngestError } from "./ingest-error";

export type QuickwitRejectedDocument = {
  document: string;
  reason: string;
  message: string;
};

export type QuickwitIngestResult = {
  received: number;
  ingested: number;
  rejected: QuickwitRejectedDocument[];
};

const UNSPECIFIED_REASON = "unspecified";

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function parseIngestResponse(body: unknown): QuickwitIngestResult {
  const response = body as Record<string, unknown> | null;
  const received = count(response?.num_docs_for_processing);
  const ingested = count(response?.num_ingested_docs);
  const rejectedCount = count(response?.num_rejected_docs);
  if (received === undefined || ingested === undefined || rejectedCount === undefined) {
    throw new QuickwitIngestError("Quickwit ingest response has an unexpected shape", QUICKWIT_WRITE_STATE.unknown);
  }

  const failures = Array.isArray(response?.parse_failures) ? (response.parse_failures as Record<string, unknown>[]) : [];
  const rejected = failures.map((failure) => ({
    document: typeof failure.document === "string" ? failure.document : "",
    reason: typeof failure.reason === "string" ? failure.reason : UNSPECIFIED_REASON,
    message: typeof failure.message === "string" ? failure.message : "",
  }));
  if (rejected.length !== rejectedCount) {
    throw new QuickwitIngestError(
      `Quickwit reported ${rejectedCount} rejected documents but listed ${rejected.length}`,
      QUICKWIT_WRITE_STATE.unknown,
    );
  }

  return { received, ingested, rejected };
}
