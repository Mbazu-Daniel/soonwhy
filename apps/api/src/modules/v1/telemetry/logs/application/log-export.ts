import { CSV_FORMULA_PREFIX } from "../domain/logs.constants";
import type { RawLogRow } from "../domain/logs.repository.types";
import { parseAttributes } from "../domain/log-fields";
import type { ExportFormat } from "../domain/log-export.types";
import { CSV_COLUMNS } from "../domain/log-export.constants";

export function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  const safe = CSV_FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function plain(row: RawLogRow) {
  return {
    timestamp: row.timestamp,
    level: row.level,
    service: row.service,
    message: row.message,
    traceId: row.traceId ?? "",
    spanId: row.spanId ?? "",
    attributes: parseAttributes(row.attributes),
  };
}

export function toNdjson(rows: RawLogRow[]): string {
  return rows.map((row) => JSON.stringify(plain(row))).join("\n") + (rows.length ? "\n" : "");
}

export function toCsv(rows: RawLogRow[]): string {
  const lines = rows.map((row) => {
    const item = plain(row);
    return CSV_COLUMNS.map((column) =>
      csvCell(column === "attributes" ? JSON.stringify(item.attributes) : item[column]),
    ).join(",");
  });
  return [CSV_COLUMNS.join(","), ...lines].join("\r\n") + "\r\n";
}

export function exportFile(format: ExportFormat) {
  return format === "csv"
    ? { contentType: "text/csv; charset=utf-8", extension: "csv" }
    : { contentType: "application/x-ndjson; charset=utf-8", extension: "ndjson" };
}
