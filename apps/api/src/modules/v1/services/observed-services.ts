import { QUICKWIT_INDEXES, QuickwitService } from "@soonwhy/shared";
import { quickwitTerm } from "../../../common/quickwit/query";
import { searchTenant } from "../../../common/telemetry/tenant-search";
import { MAX_OBSERVED_SERVICES, SYNC_LOOKBACK_MS } from "./service-sync.constants";

interface ServiceTerms {
  buckets?: Array<{ key: string }>;
}

export async function observedServiceNames(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  exclude: string[] = [],
): Promise<string[]> {
  const now = Date.now();
  const indexes = ["requests", "logs", "traces"] as const;
  const extra = exclude.length
    ? `NOT (${exclude.map((name) => quickwitTerm("service", name)).join(" OR ")})`
    : "*";
  const settled = await Promise.allSettled(
    indexes.map((index) =>
      searchTenant(quickwit, index, { orgId, projectId }, {
        filter: extra,
        startTimestamp: Math.floor((now - SYNC_LOOKBACK_MS) / 1000),
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
  const names = new Set<string>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const terms = result.value?.aggregations?.services as ServiceTerms | undefined;
    for (const bucket of terms?.buckets ?? []) {
      const name = String(bucket.key ?? "").trim();
      if (name) names.add(name);
    }
  }
  return [...names];
}
