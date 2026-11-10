import { QUICKWIT_INDEXES, QuickwitService } from "@soonwhy/shared";
import { quickwitTenantQuery, quickwitTerm, sanitizeRequestUrl } from "../../../common/quickwit/query";
import type { DatabaseConnectionPoolSample } from "../intelligence/database-connection-pool.detector";
import type { DatabaseConnectionWaitSample } from "../intelligence/database-connection-wait.detector";
import type { DatabaseQueryTrace } from "../intelligence/database-query.detector";
import type { Aggregations, EndpointAggregations, MetricSource, RequestSource, ServiceBucket, TraceSource } from "./detection.types";

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

export async function searchEndpointBuckets(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Array<{ key: string; latency: number; errorRate: number; doc_count: number }>> {
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
          endpoints: {
            terms: {
              field: "url",
              size: 100,
              order: { _count: "desc" },
            },
            aggs: {
              methods: {
                terms: {
                  field: "method",
                  size: 20,
                  order: { _key: "asc" },
                },
                aggs: {
                  latency: {
                    percentiles: {
                      field: "duration",
                      percents: [95],
                    },
                  },
                  errors: {
                    filter: {
                      query: "statusCode:[500 TO 599]",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const aggregation = (result.aggregations as EndpointAggregations | undefined)?.services;
  return (aggregation?.buckets ?? []).flatMap((serviceBucket) =>
    (serviceBucket.endpoints?.buckets ?? []).flatMap((endpointBucket) =>
      endpointBucket.methods?.buckets?.flatMap((methodBucket) => {
        const latency = methodBucket.latency?.values?.["95.0"] ?? 0;
        const errors = methodBucket.errors?.doc_count ?? 0;
        if (!methodBucket.key || latency <= 0) return [];

        return [{
          key: serviceBucket.key + "|" + methodBucket.key + "|" + endpointBucket.key,
          latency,
          errorRate: methodBucket.doc_count ? errors / methodBucket.doc_count : 0,
          doc_count: methodBucket.doc_count,
        }];
      }) ?? [],
    ),
  );
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
    const source = hit._source;
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
    const source = hit._source;
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
    const source = hit._source;
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
    sortBy: ["-duration"],
  });

  return (result.hits ?? []).flatMap((hit) => {
    const source = hit._source;
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

export async function searchTraceDurations(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Map<string, number>> {
  const result = await quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
    query: quickwitTenantQuery(orgId, projectId),
    startTimestamp,
    endTimestamp,
    maxHits: 5000,
    sortBy: ["-duration"],
  });

  const traces = new Map<string, { start: number; end: number }>();

  for (const hit of result.hits ?? []) {
    const source = hit._source;
    if (!source?.traceId) continue;

    const start = new Date(String(source.timestamp ?? "")).getTime();
    const duration = Number(source.duration ?? 0);
    if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) continue;

    const end = start + duration;
    const existing = traces.get(source.traceId);
    if (!existing) {
      traces.set(source.traceId, { start, end });
      continue;
    }

    existing.start = Math.min(existing.start, start);
    existing.end = Math.max(existing.end, end);
  }

  return new Map(
    Array.from(traces.entries())
      .map(([traceId, value]) => [traceId, value.end - value.start] as const)
      .filter(([, duration]) => duration > 0),
  );
}

export async function searchTraceSpanCandidates(
  quickwit: QuickwitService,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Array<{ traceId: string; spanId: string; spanName: string; serviceName: string; spanDuration: number; traceDuration: number }>> {
  const result = await quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
    query: quickwitTenantQuery(orgId, projectId),
    startTimestamp,
    endTimestamp,
    maxHits: 5000,
    sortBy: ["-duration"],
  });

  const traces = new Map<string, {
    start: number;
    end: number;
    duration: number;
    rootService: string;
    spans: TraceSource[];
  }>();

  for (const hit of result.hits) {
    const source = hit._source;
    if (!source?.traceId) continue;

    const trace = traces.get(source.traceId) ?? {
      start: Number.POSITIVE_INFINITY,
      end: 0,
      duration: 0,
      rootService: String(source.service ?? ""),
      spans: [],
    };
    trace.spans.push(source);

    const startMs = new Date(String(source.timestamp ?? "")).getTime();
    const duration = Number(source.duration ?? 0);
    if (Number.isFinite(startMs) && Number.isFinite(duration) && duration > 0) {
      trace.start = Math.min(trace.start, startMs);
      trace.end = Math.max(trace.end, startMs + duration);
      trace.duration = trace.end - trace.start;
    }

    if (!source.parentSpanId) {
      trace.rootService = String(source.service ?? trace.rootService);
    }

    traces.set(source.traceId, trace);
  }

  return Array.from(traces.entries()).flatMap(([traceId, trace]) => {
    const starts = trace.spans
      .map((span) => new Date(String(span.timestamp ?? "")).getTime())
      .filter(Number.isFinite);
    if (!starts.length || trace.duration <= Math.min(...starts)) return [];

    const traceDuration = trace.duration - Math.min(...starts);
    const candidate = trace.spans
      .filter((span) => Number(span.duration ?? 0) > 0)
      .sort((a, b) => Number(b.duration ?? 0) - Number(a.duration ?? 0))[0];

    if (!candidate) return [];

    return [{
      traceId,
      spanId: String(candidate.spanId ?? ""),
      spanName: String(candidate.name ?? ""),
      serviceName: String(candidate.service ?? trace.rootService),
      spanDuration: Number(candidate.duration ?? 0),
      traceDuration,
    }];
  });
}

function metricString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
