import { Injectable, Logger } from "@nestjs/common";
import { requiredEnvInProduction } from "../env";

export interface QuickwitHit<T> {
  _source?: T;
  [key: string]: unknown;
}

export interface QuickwitSearchResponse<T> {
  hits: QuickwitHit<T>[];
  num_hits: number;
  elapsed_time_micros: number;
  aggregations?: Record<string, unknown>;
}

export interface QuickwitSearchInput {
  query: string;
  startTimestamp?: number;
  endTimestamp?: number;
  maxHits?: number;
  startOffset?: number;
  sortBy?: string[];
  searchField?: string[];
  aggregations?: Record<string, unknown>;
}

export interface QuickwitIndexDescription {
  index_id: string;
  num_published_splits: number;
  size_published_splits: number;
  num_published_docs: number;
  size_published_docs_uncompressed: number;
  min_timestamp?: number | null;
  max_timestamp?: number | null;
}

export interface QuickwitSplit {
  split_state: string;
  update_timestamp?: number;
  publish_timestamp?: number | null;
  num_docs?: number;
  footer_offsets?: { start: number; end: number };
  maturity?: { type: string; maturation_period_millis?: number };
}

@Injectable()
export class QuickwitService {
  private readonly logger = new Logger(QuickwitService.name);
  private readonly baseUrl = (
    requiredEnvInProduction("QUICKWIT_URL", "http://localhost:7280")
  ).replace(/\/$/, "");
  private readonly timeoutMs = parseTimeout(
    process.env.QUICKWIT_TIMEOUT_MS,
    30_000,
  );

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        "content-type": "application/json",
        ...init.headers,
      },
      body: init.body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Quickwit request failed (${response.status}): ${body}`);
    }

    return response.json() as Promise<T>;
  }

  describeIndex(indexId: string): Promise<QuickwitIndexDescription> {
    return this.request<QuickwitIndexDescription>(
      `/api/v1/indexes/${encodeURIComponent(indexId)}/describe`,
      { method: "GET" },
    );
  }

  async listSplits(indexId: string, limit = 1000): Promise<QuickwitSplit[]> {
    const states = "Published,Staged,MarkedForDeletion";
    const result = await this.request<{ splits?: QuickwitSplit[] }>(
      `/api/v1/indexes/${encodeURIComponent(indexId)}/splits?limit=${Math.trunc(limit)}&split_states=${states}`,
      { method: "GET" },
    );
    return result.splits ?? [];
  }

  private async indexExists(indexId: string): Promise<boolean> {
    try {
      const list = await this.request<
        Array<{ index_config?: { index_id?: string } }>
      >("/api/v1/indexes", { method: "GET" });
      return (
        Array.isArray(list) &&
        list.some((entry) => entry?.index_config?.index_id === indexId)
      );
    } catch {
      return false;
    }
  }

  async ensureIndex(indexId: string, config: Record<string, unknown>): Promise<void> {
    if (await this.indexExists(indexId)) {
      await this.syncFieldMappings(indexId, config);
      return;
    }
    try {
      await this.request("/api/v1/indexes", {
        method: "POST",
        body: JSON.stringify({ ...config, index_id: indexId }),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("index `" + indexId + "` already exist")
      ) {
        return;
      }
      throw error;
    }
  }

  async syncFieldMappings(
    indexId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const desired = fieldMappingsOf(config);
    if (!desired.length) return;
    try {
      const current = await this.request<{
        index_config?: Record<string, unknown>;
      }>(`/api/v1/indexes/${encodeURIComponent(indexId)}`, { method: "GET" });
      const indexConfig = current.index_config;
      if (!indexConfig) return;
      const docMapping = (indexConfig.doc_mapping ?? {}) as Record<string, unknown>;
      const existing = (docMapping.field_mappings ?? []) as FieldMapping[];
      const merged = mergeFieldMappings(existing, desired);
      if (!merged.changed) return;
      const { doc_mapping_uid: _ignored, ...mapping } = docMapping;
      await this.request(`/api/v1/indexes/${encodeURIComponent(indexId)}`, {
        method: "PUT",
        body: JSON.stringify({
          ...indexConfig,
          doc_mapping: { ...mapping, field_mappings: merged.fieldMappings },
        }),
      });
      this.logger.log(`Updated field mappings for index ${indexId}`);
    } catch (error) {
      this.logger.warn(
        `Could not update field mappings for ${indexId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async ingest(indexId: string, documents: Record<string, unknown>[]): Promise<void> {
    if (documents.length === 0) return;
    const ndjson = documents
      .map((document) => JSON.stringify(document))
      .join("\n");
    await this.request(
      `/api/v1/${encodeURIComponent(indexId)}/ingest?commit=auto`,
      {
        method: "POST",
        headers: { "content-type": "application/x-ndjson" },
        body: ndjson,
      },
    );
  }

  async search<T>(
    indexId: string,
    input: QuickwitSearchInput,
  ): Promise<QuickwitSearchResponse<T>> {
    return this.request<QuickwitSearchResponse<T>>(
      `/api/v1/${encodeURIComponent(indexId)}/search`,
      {
        method: "POST",
        body: JSON.stringify({
          query: input.query,
          max_hits: input.maxHits ?? 20,
          start_offset: input.startOffset ?? 0,
          ...(input.startTimestamp !== undefined
            ? { start_timestamp: input.startTimestamp }
            : {}),
          ...(input.endTimestamp !== undefined
            ? { end_timestamp: input.endTimestamp }
            : {}),
          ...(input.sortBy?.length ? { sort_by: input.sortBy.join(",") } : {}),
          ...(input.searchField?.length
            ? { search_field: input.searchField.join(",") }
            : {}),
          ...(input.aggregations
            ? { aggs: input.aggregations }
            : {}),
        }),
      },
    );
  }

  async purgeOlderThan(
    indexId: string,
    timestampField: string,
    cutoffIso: string,
  ): Promise<void> {
    await this.purgeByQuery(indexId, `${timestampField}:[* TO ${cutoffIso}]`);
  }

  async purgeByQuery(indexId: string, query: string): Promise<void> {
    await this.request(`/api/v1/${encodeURIComponent(indexId)}/delete-tasks`, {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  }
}

function parseTimeout(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

type FieldMapping = { name?: string; [key: string]: unknown };

function fieldMappingsOf(config: Record<string, unknown>): FieldMapping[] {
  const docMapping = config.doc_mapping as { field_mappings?: FieldMapping[] } | undefined;
  return docMapping?.field_mappings ?? [];
}

const BEHAVIOUR_KEYS = ["type", "tokenizer", "record"] as const;

function sameMapping(existing: FieldMapping, wanted: FieldMapping): boolean {
  return BEHAVIOUR_KEYS.every(
    (key) => wanted[key] === undefined || existing[key] === wanted[key],
  );
}

export function mergeFieldMappings(
  existing: FieldMapping[],
  desired: FieldMapping[],
): { fieldMappings: FieldMapping[]; changed: boolean } {
  const result = [...existing];
  let changed = false;
  for (const wanted of desired) {
    const index = result.findIndex((item) => item.name === wanted.name);
    if (index === -1) {
      result.push(wanted);
      changed = true;
    } else if (!sameMapping(result[index]!, wanted)) {
      result[index] = wanted;
      changed = true;
    }
  }
  return { fieldMappings: result, changed };
}
