import type { QuickwitIngestResult } from "@soonwhy/shared";

export class AmbiguousIngestResultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmbiguousIngestResultError";
  }
}

export type RejectedRow<T> = { row: T; reason: string; message: string };

export type IngestOutcome<T> = { accepted: T[]; rejected: RejectedRow<T>[] };

function eventIdOf(document: string): string | undefined {
  try {
    const value = (JSON.parse(document) as { eventId?: unknown }).eventId;
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function splitIngestOutcome<T extends { eventId: string }>(rows: T[], result: QuickwitIngestResult): IngestOutcome<T> {
  if (result.ingested + result.rejected.length !== rows.length) {
    throw new AmbiguousIngestResultError(
      `Quickwit accounted for ${result.ingested + result.rejected.length} of ${rows.length} documents`,
    );
  }

  const byLine = new Map(rows.map((row) => [JSON.stringify(row), row]));
  const byEventId = new Map(rows.map((row) => [row.eventId, row]));
  const rejected = new Map<string, RejectedRow<T>>();
  for (const failure of result.rejected) {
    const eventId = eventIdOf(failure.document);
    const row = byLine.get(failure.document) ?? (eventId ? byEventId.get(eventId) : undefined);
    if (!row) throw new AmbiguousIngestResultError("Quickwit rejected a document that cannot be matched to a sent row");
    rejected.set(row.eventId, { row, reason: failure.reason, message: failure.message });
  }
  if (rejected.size !== result.rejected.length) {
    throw new AmbiguousIngestResultError("Quickwit listed the same rejected document more than once");
  }

  return { accepted: rows.filter((row) => !rejected.has(row.eventId)), rejected: [...rejected.values()] };
}
