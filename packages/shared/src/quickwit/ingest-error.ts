export const QUICKWIT_WRITE_STATE = {
  notWritten: "not_written",
  unknown: "unknown",
} as const;

export type QuickwitWriteState = (typeof QUICKWIT_WRITE_STATE)[keyof typeof QUICKWIT_WRITE_STATE];

const NOT_WRITTEN_NETWORK_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);
const REQUEST_TIMEOUT_STATUS = 408;
const CLIENT_ERROR_MIN = 400;
const SERVER_ERROR_MIN = 500;

export class QuickwitIngestError extends Error {
  constructor(
    message: string,
    readonly writeState: QuickwitWriteState,
    readonly status?: number,
  ) {
    super(message);
    this.name = "QuickwitIngestError";
  }
}

function networkCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: unknown } } | undefined)?.cause;
  const code = cause?.code ?? (error as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? code : undefined;
}

export function classifyIngestFailure(error: unknown): QuickwitIngestError {
  if (error instanceof QuickwitIngestError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const code = networkCode(error);
  const state = code && NOT_WRITTEN_NETWORK_CODES.has(code) ? QUICKWIT_WRITE_STATE.notWritten : QUICKWIT_WRITE_STATE.unknown;
  return new QuickwitIngestError(`Quickwit ingest failed${code ? ` (${code})` : ""}: ${message}`, state);
}

export function classifyIngestStatus(status: number, body: string): QuickwitIngestError {
  const rejectedBeforeAppend =
    status >= CLIENT_ERROR_MIN && status < SERVER_ERROR_MIN && status !== REQUEST_TIMEOUT_STATUS;
  return new QuickwitIngestError(
    `Quickwit ingest failed (${status}): ${body}`,
    rejectedBeforeAppend ? QUICKWIT_WRITE_STATE.notWritten : QUICKWIT_WRITE_STATE.unknown,
    status,
  );
}
