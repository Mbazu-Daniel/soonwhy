import { QUICKWIT_INDEXES, type QuickwitSearchInput } from "@soonwhy/shared";

export interface TenantScope {
  orgId: string;
  projectId: string;
}

export type TelemetryIndex = keyof typeof QUICKWIT_INDEXES;

export type TenantSearchInput = Omit<QuickwitSearchInput, "query"> & { filter?: string };
