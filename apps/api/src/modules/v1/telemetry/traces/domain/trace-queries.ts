import { FILTER_OPERATORS, MAX_QUERY_ROWS, REPEATED_QUERY_COUNT, SLOW_QUERY_AVG_MS, SQL_ATTRIBUTE_KEYS } from "./trace-queries.constants";
import type { QueryHint, QuerySpan, TraceQuery, TraceQuerySummary } from "./trace-queries.types";

const TABLE_PATTERN = /\b(?:from|update|into|join)\s+("?[\w.]+"?)/i;
const OPERATION_PATTERN = /^\s*(\w+)/;
const WHERE_PATTERN = /\bwhere\b([\s\S]*?)(?:\bgroup\s+by\b|\border\s+by\b|\blimit\b|\breturning\b|$)/i;
const FILTER_PATTERN = new RegExp(`("?[\\w.]+"?)\\s*(?:${FILTER_OPERATORS})\\s*(?:\\?|\\$\\?|\\()`, "gi");

function queryTextOf(span: QuerySpan): string | undefined {
  const candidates = [span.dbQueryText, ...SQL_ATTRIBUTE_KEYS.map((key) => span.attributes?.[key])];
  const text = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof text === "string" ? text.trim() : undefined;
}

function unquote(identifier: string): string {
  return identifier.replace(/"/g, "");
}

export function describeQuery(query: string) {
  const operation = (OPERATION_PATTERN.exec(query)?.[1] ?? "").toUpperCase();
  const table = TABLE_PATTERN.exec(query)?.[1];
  const where = WHERE_PATTERN.exec(query)?.[1] ?? "";
  const filterColumns = [...where.matchAll(FILTER_PATTERN)].map((match) => unquote(match[1]!).split(".").pop()!).filter((column) => column && !/^\d/.test(column));
  return {
    operation,
    table: table ? unquote(table) : null,
    filterColumns: [...new Set(filterColumns)],
    hasWhere: /\bwhere\b/i.test(query),
    hasLimit: /\blimit\b/i.test(query),
  };
}

function hintsFor(query: string, stats: { count: number; avgMs: number }): QueryHint[] {
  const shape = describeQuery(query);
  const hints: QueryHint[] = [];
  if (stats.count >= REPEATED_QUERY_COUNT) {
    hints.push({ kind: "repeated", message: `Runs ${stats.count} times in this request. Load the rows in one query with a join or an IN list.` });
  }
  const readsRows = ["SELECT", "UPDATE", "DELETE"].includes(shape.operation);
  if (readsRows && shape.table && shape.filterColumns.length > 0 && (stats.avgMs >= SLOW_QUERY_AVG_MS || stats.count >= REPEATED_QUERY_COUNT)) {
    hints.push({
      kind: "index",
      message: `Filters ${shape.table} by ${shape.filterColumns.join(", ")}. Check that an index covers ${shape.filterColumns.length > 1 ? "these columns" : "this column"}, and run EXPLAIN on it.`,
    });
  }
  if (shape.operation === "SELECT" && shape.table && !shape.hasWhere && !shape.hasLimit) {
    hints.push({ kind: "unfiltered", message: `Reads every row of ${shape.table}. Add a filter or a LIMIT.` });
  }
  return hints;
}

export function analyzeTraceQueries(spans: QuerySpan[], traceMs: number): TraceQuerySummary {
  const groups = new Map<string, { durations: number[]; spanId: string }>();
  for (const span of spans) {
    const query = queryTextOf(span);
    if (!query) continue;
    const group = groups.get(query) ?? { durations: [], spanId: span.spanId };
    group.durations.push(Number(span.duration) || 0);
    groups.set(query, group);
  }

  const queries: TraceQuery[] = [...groups.entries()].map(([query, group]) => {
    const totalMs = group.durations.reduce((sum, value) => sum + value, 0);
    const count = group.durations.length;
    const avgMs = totalMs / count;
    const shape = describeQuery(query);
    return {
      query,
      operation: shape.operation,
      table: shape.table,
      filterColumns: shape.filterColumns,
      count,
      totalMs,
      maxMs: Math.max(...group.durations),
      avgMs,
      shareOfTrace: traceMs > 0 ? Math.min(1, totalMs / traceMs) : 0,
      spanId: group.spanId,
      hints: hintsFor(query, { count, avgMs }),
    };
  });

  queries.sort((a, b) => b.totalMs - a.totalMs);
  return {
    queryCount: queries.reduce((sum, item) => sum + item.count, 0),
    totalQueryMs: queries.reduce((sum, item) => sum + item.totalMs, 0),
    traceMs,
    queries: queries.slice(0, MAX_QUERY_ROWS),
  };
}
