import { Injectable } from "@nestjs/common";
import { type QuickwitSearchInput, QuickwitService } from "@soonwhy/shared";
import { quickwitTenantQuery, quickwitTimestamp } from "../quickwit/query";
import { searchTenant, type TelemetryIndex } from "./tenant-search";

export interface TelemetryRange {
  from: string;
  to: string;
  startTimestamp: number;
  endTimestamp: number;
}

export interface TelemetryQuery {
  orgId: string;
  projectId: string;
  from: string;
  to: string;
  filters?: string[];
}

@Injectable()
export class TelemetryQueryService {
  constructor(private readonly quickwit: QuickwitService) {}

  range(from?: string, to?: string): TelemetryRange {
    const end = to ? new Date(to).getTime() : Date.now();
    const start = from ? new Date(from).getTime() : end - 86_400_000;
    return {
      from: new Date(start).toISOString(),
      to: new Date(end).toISOString(),
      startTimestamp: Math.floor(start / 1000),
      endTimestamp: Math.floor(end / 1000),
    };
  }

  tenantQuery(query: TelemetryQuery): string {
    const filters = query.filters?.filter(Boolean) ?? [];
    return quickwitTenantQuery(
      query.orgId,
      query.projectId,
      filters.length ? filters.join(" AND ") : "*",
    );
  }

  search<T>(
    index: TelemetryIndex,
    query: TelemetryQuery,
    options: Omit<QuickwitSearchInput, "query" | "startTimestamp" | "endTimestamp"> = {},
  ) {
    const filters = query.filters?.filter(Boolean) ?? [];
    return searchTenant<T>(this.quickwit, index, query, {
      ...options,
      filter: filters.join(" AND "),
      startTimestamp: quickwitTimestamp(query.from),
      endTimestamp: quickwitTimestamp(query.to),
    });
  }
}
