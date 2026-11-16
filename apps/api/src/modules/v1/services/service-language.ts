import { QuickwitService } from "@soonwhy/shared";
import { quickwitSource, quickwitTerm } from "../../../common/quickwit/query";
import { searchTenant } from "../../../common/telemetry/tenant-search";
import { languageFromSdk } from "./sdk-language";

interface SpanResource {
  resourceAttributes?: Record<string, unknown>;
}

function sdkLanguageOf(source: SpanResource | undefined): unknown {
  const attributes = source?.resourceAttributes;
  if (!attributes) return undefined;
  const nested = (attributes.telemetry as { sdk?: { language?: unknown } } | undefined)?.sdk?.language;
  return attributes["telemetry.sdk.language"] ?? nested;
}

export async function detectServiceLanguage(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  serviceName: string,
): Promise<string | null> {
  const result = await searchTenant<SpanResource>(quickwit, "traces", { orgId, projectId }, {
    filter: quickwitTerm("service", serviceName),
    maxHits: 1,
  });
  const hit = result.hits[0];
  return languageFromSdk(sdkLanguageOf(hit ? quickwitSource<SpanResource>(hit) ?? undefined : undefined));
}
