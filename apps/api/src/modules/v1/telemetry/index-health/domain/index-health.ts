import type { QuickwitIndexDescription, QuickwitSplit } from "@soonwhy/shared";
import type { IndexHealth, IndexStatus, SplitSummary } from "./index-health.types";
import { SPLIT_LIST_LIMIT } from "./index-health.constants";

const iso = (seconds: number | null | undefined): string | null =>
  typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;

export function summarizeSplits(splits: QuickwitSplit[], limit: number = SPLIT_LIST_LIMIT): SplitSummary {
  let lastPublished = 0;
  const count = (state: string) => splits.filter((split) => split.split_state === state).length;
  for (const split of splits) {
    lastPublished = Math.max(lastPublished, split.publish_timestamp ?? 0);
  }
  return {
    published: count("Published"),
    staged: count("Staged"),
    markedForDeletion: count("MarkedForDeletion"),
    immature: splits.filter((split) => split.split_state === "Published" && split.maturity?.type === "immature").length,
    lastPublishedAt: iso(lastPublished),
    truncated: splits.length >= limit,
  };
}

export function indexStatus(
  documents: number,
  newestEventAt: string | null,
  staleAfterMinutes: number,
  now: Date = new Date(),
): IndexStatus {
  if (documents === 0 || !newestEventAt) return "empty";
  const ageMinutes = (now.getTime() - new Date(newestEventAt).getTime()) / 60_000;
  return ageMinutes > staleAfterMinutes ? "stale" : "healthy";
}

export function toIndexHealth(
  description: QuickwitIndexDescription,
  splits: QuickwitSplit[],
  staleAfterMinutes: number,
  now: Date = new Date(),
): IndexHealth {
  const newestEventAt = iso(description.max_timestamp);
  return {
    indexId: description.index_id,
    status: indexStatus(description.num_published_docs, newestEventAt, staleAfterMinutes, now),
    documents: description.num_published_docs,
    sizeBytes: description.size_published_splits,
    uncompressedBytes: description.size_published_docs_uncompressed,
    oldestEventAt: iso(description.min_timestamp),
    newestEventAt,
    splits: summarizeSplits(splits),
  };
}

export function unavailableIndex(indexId: string, error: unknown): IndexHealth {
  return {
    indexId,
    status: "unavailable",
    documents: 0,
    sizeBytes: 0,
    uncompressedBytes: 0,
    oldestEventAt: null,
    newestEventAt: null,
    splits: { published: 0, staged: 0, markedForDeletion: 0, immature: 0, lastPublishedAt: null, truncated: false },
    error: error instanceof Error ? error.message.slice(0, 200) : "Index is not reachable",
  };
}
