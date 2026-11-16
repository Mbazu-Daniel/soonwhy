import { QuickwitService } from "@soonwhy/shared";
import { searchTenant } from "../../../common/telemetry/tenant-search";
import { MAX_OBSERVED_SERVICES } from "./service-sync.constants";

export type TelemetryState = "active" | "stale" | "none";

export const ACTIVE_WINDOW_MS = 15 * 60_000;
export const STALE_WINDOW_MS = 7 * 86_400_000;

interface ServiceTerms {
  buckets?: Array<{ key: string }>;
}

export async function servicesSeenWithin(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  windowMs: number,
  now = Date.now(),
): Promise<Set<string>> {
  const settled = await Promise.allSettled(
    (["requests", "logs", "traces"] as const).map((index) =>
      searchTenant(quickwit, index, { orgId, projectId }, {
        startTimestamp: Math.floor((now - windowMs) / 1000),
        endTimestamp: Math.floor(now / 1000) + 60,
        maxHits: 0,
        aggregations: {
          services: { terms: { field: "service", size: MAX_OBSERVED_SERVICES } },
        },
      }),
    ),
  );
  if (settled.every((result) => result.status === "rejected")) {
    throw new Error("No telemetry index could be read");
  }
  const seen = new Set<string>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const terms = result.value?.aggregations?.services as ServiceTerms | undefined;
    for (const bucket of terms?.buckets ?? []) {
      const name = String(bucket.key ?? "").trim();
      if (name) seen.add(name);
    }
  }
  return seen;
}

export function telemetryStateOf(
  name: string,
  active: Set<string>,
  recent: Set<string>,
): TelemetryState {
  if (active.has(name)) return "active";
  return recent.has(name) ? "stale" : "none";
}
