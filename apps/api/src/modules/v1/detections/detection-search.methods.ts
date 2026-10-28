// Extracted from detection.service.ts:searchServiceBuckets
export async function searchServiceBuckets(
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<ServiceBucket[]> {
  const result = await import("@soonwhy/shared").then(
    (m) => m.QUICKWIT_INDEXES.requests,
  );
  // ... implementation extracted from detection.service.ts lines 1494-1525
  throw new Error("Not implemented - migrate gradually");
}

// Extracted from detection.service.ts:searchEndpointBuckets
export async function searchEndpointBuckets(
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Map<string, string>> {
  // ... implementation extracted from detection.service.ts lines 1861-1889
  throw new Error("Not implemented - migrate gradually");
}

// Extracted from detection.service.ts:searchDependencyBuckets
export async function searchDependencyBuckets(
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<
  Array<{
    key: string;
    serviceName: string;
    dependencyType: string;
    dependencyName: string;
    latency: number;
    samples: number;
    errorCount: number;
    errorRate: number;
  }>
> {
  // ... implementation extracted from detection.service.ts lines 1659-1746
  throw new Error("Not implemented - migrate gradually");
}

import type { DatabaseConnectionPoolSample } from '../intelligence/database-connection-pool.detector';
import type { DatabaseConnectionWaitSample } from '../intelligence/database-connection-wait.detector';
import type { DatabaseQueryTrace } from '../intelligence/database-query.detector';
import type { ServiceBucket } from './detection.types';

export async function searchDatabaseConnectionPoolMetrics(
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<DatabaseConnectionPoolSample[]> {
  return [];
}

export async function searchDatabaseConnectionWaitMetrics(
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<DatabaseConnectionWaitSample[]> {
  return [];
}

export async function searchRequestEndpoints(
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Map<string, string>> {
  return new Map();
}

export async function searchDatabaseQuerySpans(
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<DatabaseQueryTrace[]> {
  return [];
}

export async function searchTraceDurations(
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Map<string, number>> {
  return new Map();
}

export async function searchTraceSpanCandidates(
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Array<{ traceId: string; spanId: string; spanName: string; serviceName: string; spanDuration: number; traceDuration: number }>> {
  return [];
}
