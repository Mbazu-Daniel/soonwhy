import type { RawLogRow } from "../domain/logs.repository.types";
import type { LogContext } from "../domain/log-context.types";

function timeOf(row: RawLogRow): number {
  const time = Date.parse(row.timestamp);
  return Number.isFinite(time) ? time : 0;
}

export function splitContext(
  anchor: { id: string; timestamp: string },
  nearBefore: RawLogRow[],
  nearAfter: RawLogRow[],
  lines: number,
): LogContext {
  const anchorTime = Date.parse(anchor.timestamp);
  const others = (rows: RawLogRow[]) => rows.filter((row) => row.id !== anchor.id);
  const before = others(nearBefore)
    .filter((row) => timeOf(row) < anchorTime)
    .sort((a, b) => timeOf(b) - timeOf(a))
    .slice(0, lines)
    .reverse();
  const after = others(nearAfter)
    .filter((row) => timeOf(row) >= anchorTime)
    .sort((a, b) => timeOf(a) - timeOf(b))
    .slice(0, lines);
  return { before, after };
}
