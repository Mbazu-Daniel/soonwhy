import { QUICKWIT_INDEXES, QuickwitService } from "@soonwhy/shared";
import { quickwitSource, quickwitTenantQuery, quickwitTerm, sanitizeRequestUrl } from "../../../common/quickwit/query";
import type { DatabaseConnectionPoolSample } from "../intelligence/database-connection-pool.detector";
import type { DatabaseConnectionWaitSample } from "../intelligence/database-connection-wait.detector";
import type { DatabaseQueryTrace } from "../intelligence/database-query.detector";
import type { Aggregations, MetricSource, RequestSource, ServiceBucket, TraceSource } from "./detection.types";

export async function searchServiceBuckets(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<ServiceBucket[]> {
  const result = await quickwit.search<never>(QUICKWIT_INDEXES.requests, {
    query: quickwitTenantQuery(orgId, projectId),
    startTimestamp,
    endTimestamp,
    maxHits: 0,
    aggregations: {
      services: {
        terms: {
          field: "service",
          size: 100,
          order: { _count: "desc" },
        },
        aggs: {
          latency: {
            percentiles: { field: "duration", percents: [50, 95, 99] },
          },
          errors: {
            filter: { query: "statusCode:[500 TO 599]" },
          },
        },
      },
    },
  });

  return (result.aggregations as Aggregations | undefined)?.services?.buckets ?? [];
}

export async function searchDependencyBuckets(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<
  Array<{
    key: string;
    serviceName: string;
    dependencyType: "database" | "cache" | "redis" | "memcached" | "queue" | "http" | "rpc" | "grpc" | "other";
    dependencyName: string;
    latency: number;
    samples: number;
    errorCount: number;
    errorRate: number;
  }>
> {
  const result = await quickwit.search<never>(QUICKWIT_INDEXES.traces, {
    query: quickwitTenantQuery(orgId, projectId, quickwitTerm("spanKind", "3")),
    startTimestamp,
    endTimestamp,
    maxHits: 0,
    aggregations: {
      dependencies: {
        terms: {
          field: "service",
          size: 100,
          order: { _count: "desc" },
        },
        aggs: {
          dependencies: {
            terms: {
              field: "dependencyName",
              size: 100,
              order: { _count: "desc" },
            },
            aggs: {
              latency: {
                percentiles: { field: "duration", percents: [95] },
              },
              errors: {
                filter: { query: "statusCode:[500 TO 599]" },
              },
              dependencyType: {
                terms: {
                  field: "dependencyType",
                  size: 1,
                },
              },
            },
          },
        },
      },
    },
  });

  const aggregation = (result.aggregations as Aggregations | undefined)?.dependencies;
  return (aggregation?.buckets ?? []).flatMap((serviceBucket) =>
    (serviceBucket.dependencies?.buckets ?? []).flatMap((dependencyBucket) => {
      const dependencyName = String(dependencyBucket.key ?? "").trim();
      const dependencyType = dependencyBucket.dependencyType?.buckets?.[0]?.key;
      if (
        !dependencyName ||
        !["database", "cache", "redis", "memcached", "queue", "http", "rpc", "grpc", "other"].includes(String(dependencyType))
      ) {
        return [];
      }

      const latency = dependencyBucket.latency?.values?.["95.0"] ?? 0;
      const samples = dependencyBucket.doc_count;
      const errorCount = dependencyBucket.errors?.doc_count ?? 0;
      if (!Number.isFinite(latency) || latency <= 0 || samples <= 0) return [];

      return [{
        key: serviceBucket.key + "|" + dependencyType + "|" + dependencyName,
        serviceName: String(serviceBucket.key),
        dependencyType: dependencyType as "database" | "cache" | "redis" | "memcached" | "queue" | "http" | "rpc" | "grpc" | "other",
        dependencyName,
        latency,
        samples,
        errorCount,
        errorRate: errorCount / samples,
      }];
    }),
  );
}

export async function searchDatabaseConnectionPoolMetrics(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<DatabaseConnectionPoolSample[]> {
  const names = [
    "db.client.connection.count",
    "db.client.connection.max",
    "db.client.connection.pending_requests",
    "db.client.connection.timeouts",
  ].map((name) => quickwitTerm("name", name)).join(" OR ");

  const result = await quickwit.search<MetricSource>(QUICKWIT_INDEXES.metrics, {
    query: quickwitTenantQuery(orgId, projectId, names),
    startTimestamp,
    endTimestamp,
    maxHits: 5000,
    sortBy: ["timestamp"],
  });

  const snapshots = new Map<string, DatabaseConnectionPoolSample>();
  for (const hit of result.hits ?? []) {
    const source = quickwitSource<MetricSource>(hit);
    const timestamp = source?.timestamp;
    const service = source?.service;
    const poolName = source?.connectionPoolName ?? metricString(source?.attributes?.["db.client.connection.pool.name"]);
    const name = source?.name;
    const value = Number(source?.value);
    if (!timestamp || !service || !poolName || !name || !Number.isFinite(value)) continue;

    const key = service + "\\0" + poolName + "\\0" + timestamp;
    const snapshot = snapshots.get(key) ?? { timestamp, service, poolName };
    const state = source?.connectionPoolState ?? metricString(source?.attributes?.["db.client.connection.state"]);

    if (name === "db.client.connection.count") {
      if (state === "used") snapshot.usedConnections = value;
    } else if (name === "db.client.connection.max") {
      snapshot.maxConnections = value;
    } else if (name === "db.client.connection.pending_requests") {
      snapshot.pendingRequests = value;
    } else if (name === "db.client.connection.timeouts") {
      snapshot.connectionTimeouts = value;
    }
    snapshots.set(key, snapshot);
  }

  return Array.from(snapshots.values());
}

export async function searchDatabaseConnectionWaitMetrics(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<DatabaseConnectionWaitSample[]> {
  const query = quickwitTerm("name", "db.client.connection.wait_time");
  const result = await quickwit.search<MetricSource>(QUICKWIT_INDEXES.metrics, {
    query: quickwitTenantQuery(orgId, projectId, query),
    startTimestamp,
    endTimestamp,
    maxHits: 5000,
    sortBy: ["timestamp"],
  });

  return (result.hits ?? []).flatMap((hit) => {
    const source = quickwitSource<MetricSource>(hit);
    const timestamp = source?.timestamp;
    const service = source?.service;
    const poolName = source?.connectionPoolName ?? metricString(source?.attributes?.["db.client.connection.pool.name"]) ?? "unknown";
    const value = Number(source?.value);
    if (!timestamp || !service || !Number.isFinite(value) || value < 0) return [];
    return [{
      timestamp,
      service,
      poolName,
      waitTimeMs: value * 1000,
    }];
  });
}

export async function searchRequestEndpoints(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Map<string, string>> {
  const result = await quickwit.search<RequestSource>(QUICKWIT_INDEXES.requests, {
    query: quickwitTenantQuery(orgId, projectId),
    startTimestamp,
    endTimestamp,
    maxHits: 5000,
    sortBy: ["timestamp"],
  });

  const endpoints = new Map<string, string>();
  for (const hit of result.hits ?? []) {
    const source = quickwitSource<RequestSource>(hit);
    const traceId = source?.traceId;
    if (!traceId) continue;

    const route = String(source?.url ?? "").trim();
    if (!route) continue;

    const sanitized = sanitizeRequestUrl(route);
    if (sanitized) endpoints.set(String(traceId), sanitized);
  }

  return endpoints;
}

export async function searchDatabaseQuerySpans(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<DatabaseQueryTrace[]> {
  const result = await quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
    query: quickwitTenantQuery(orgId, projectId, quickwitTerm("dependencyType", "database")),
    startTimestamp,
    endTimestamp,
    maxHits: 5000,
    sortBy: ["duration:desc"],
  });

  return (result.hits ?? []).flatMap((hit) => {
    const source = quickwitSource<TraceSource>(hit);
    if (!source?.traceId || !source.service) return [];

    const query = source.dbQueryText;
    const summary = source.dbQuerySummary;
    const operation = source.dbOperationName;
    const system = source.dbSystemName;
    const collection = source.dbCollectionName;
    const returnedRows = Number.isFinite(source.dbReturnedRows) ? source.dbReturnedRows : undefined;
    const batchSize = Number.isFinite(source.dbBatchSize) ? source.dbBatchSize : undefined;
    const responseBytes = Number.isFinite(source.dbResponseBytes) ? source.dbResponseBytes : undefined;
    const endpoint = source.httpRoute ?? source.endpoint;

    const dependencyName = String(source.dependencyName ?? system ?? source.name ?? "");
    const queryIdentity = query ?? summary ?? operation ?? dependencyName;
    if (!queryIdentity) return [];

    return [{
      timestamp: String(source.timestamp ?? ""),
      service: String(source.service),
      traceId: String(source.traceId),
      spanId: String(source.spanId ?? ""),
      ...(source.parentSpanId ? { parentSpanId: String(source.parentSpanId) } : {}),
      duration: Number(source.duration ?? 0),
      ...(Number.isFinite(source.statusCode) ? { statusCode: Number(source.statusCode) } : {}),
      ...(source.statusMessage ? { statusMessage: String(source.statusMessage) } : {}),
      ...(source.errorType ? { errorType: String(source.errorType) } : {}),
      dependencyType: "database",
      dependencyName,
      ...(source.name ? { spanName: String(source.name) } : {}),
      ...(query ? { dbQueryText: query } : {}),
      ...(summary ? { dbQuerySummary: summary } : {}),
      ...(operation ? { dbOperationName: operation } : {}),
      ...(system ? { dbSystemName: system } : {}),
      ...(collection ? { dbCollectionName: collection } : {}),
      ...(returnedRows !== undefined ? { dbReturnedRows: returnedRows } : {}),
      ...(batchSize !== undefined ? { dbBatchSize: batchSize } : {}),
      ...(responseBytes !== undefined ? { dbResponseBytes: responseBytes } : {}),
      ...(endpoint ? { httpRoute: endpoint, endpoint } : {}),
    }];
  });
}

function metricString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
