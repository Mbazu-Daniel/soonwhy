import { QUICKWIT_INDEXES, type QuickwitSearchInput, type QuickwitService } from "@soonwhy/shared";
import { quickwitTenantQuery } from "../quickwit/query";

export interface TenantScope {
  orgId: string;
  projectId: string;
}

export type TelemetryIndex = keyof typeof QUICKWIT_INDEXES;

export type TenantSearchInput = Omit<QuickwitSearchInput, "query"> & { filter?: string };

export function searchTenant<T>(
  quickwit: Pick<QuickwitService, "search">,
  index: TelemetryIndex,
  scope: TenantScope,
  input: TenantSearchInput = {},
) {
  if (!scope.orgId || !scope.projectId) {
    throw new Error("A telemetry search needs an organization and a project");
  }
  const { filter, ...rest } = input;
  return quickwit.search<T>(QUICKWIT_INDEXES[index], {
    ...rest,
    query: quickwitTenantQuery(scope.orgId, scope.projectId, filter || "*"),
  });
}
