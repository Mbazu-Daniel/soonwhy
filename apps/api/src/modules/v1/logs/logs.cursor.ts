import { MAX_RESULT_WINDOW } from "./logs.constants";

export function decodeOffset(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as { offset?: unknown };
    const offset = Number(decoded.offset);
    return Number.isInteger(offset) && offset >= 0 ? Math.min(offset, MAX_RESULT_WINDOW) : 0;
  } catch {
    return 0;
  }
}

export function nextOffsetCursor(offset: number, returned: number, limit: number): string | undefined {
  const next = offset + returned;
  if (returned < limit || next + limit > MAX_RESULT_WINDOW) return undefined;
  return Buffer.from(JSON.stringify({ offset: next })).toString("base64");
}
