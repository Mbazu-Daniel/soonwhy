import { quickwitTerm } from "../../../common/quickwit/query";
import { REQUEST_SPAN_FILTER } from "../../../common/telemetry/span-filters";

export interface TraceFilter {
  q?: string;
  traceIds?: string[];
  service?: string;
  operation?: string;
  minDuration?: number;
  maxDuration?: number;
}

export function traceFilters(filter: TraceFilter): string[] {
  const filters = [REQUEST_SPAN_FILTER];
  if (filter.q) filters.push(`(${quickwitTerm("traceId", filter.q)} OR ${quickwitTerm("name", filter.q)})`);
  if (filter.traceIds?.length) filters.push(traceIdList(filter.traceIds));
  if (filter.service) filters.push(quickwitTerm("service", filter.service));
  if (filter.operation) filters.push(quickwitTerm("name", filter.operation));
  if (filter.minDuration !== undefined) filters.push(`duration:>=${filter.minDuration}`);
  if (filter.maxDuration !== undefined) filters.push(`duration:<=${filter.maxDuration}`);
  return filters;
}

export function traceIdList(ids: string[]): string {
  return `traceId:(${ids.map((id) => quickwitTerm("traceId", id).slice("traceId:".length)).join(" OR ")})`;
}
