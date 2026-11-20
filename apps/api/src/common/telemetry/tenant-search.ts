import { QUICKWIT_INDEXES, type QuickwitService } from "@soonwhy/shared";
import { quickwitOrgQuery, quickwitTenantQuery } from "../quickwit/query";
import type { TenantScope, TelemetryIndex, TenantSearchInput } from "./tenant-search.types";

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

export function searchOrg<T>(
  quickwit: Pick<QuickwitService, "search">,
  index: TelemetryIndex,
  orgId: string,
  input: TenantSearchInput = {},
) {
  if (!orgId) throw new Error("A telemetry search needs an organization");
  const { filter, ...rest } = input;
  return quickwit.search<T>(QUICKWIT_INDEXES[index], {
    ...rest,
    query: quickwitOrgQuery(orgId, filter || "*"),
  });
}
