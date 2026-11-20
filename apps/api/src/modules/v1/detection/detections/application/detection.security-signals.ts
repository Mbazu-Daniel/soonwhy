import { quickwitSource } from "../../../../../common/quickwit/query";
import { searchTenant } from "../../../../../common/telemetry/tenant-search";
import { detectAuthFailureSpikes, findSecretExposures } from "../domain/security-signals";
import {
  AUTH_FAILURE_GROWTH_FACTOR,
  AUTH_FAILURE_MIN_COUNT,
  AUTH_FAILURE_QUERY,
  SECRET_SCAN_MAX_LOGS,
} from "../domain/security-signals.constants";
import type { AuthFailureCount, LogLine } from "../domain/security-signals.types";
import { WINDOW_MS } from "../domain/detection.stage.constants";
import type { DetectionFinding } from "../domain/detection.types";
import type { DetectionStageContext, DetectionStageDeps } from "./detection.stage.types";

export async function detectSecuritySignals(
  deps: DetectionStageDeps,
  context: DetectionStageContext,
): Promise<DetectionFinding[]> {
  const { orgId, projectId, start, end, startTimestamp, endTimestamp, detectorEnabled } = context;
  const detected: DetectionFinding[] = [];

  if (detectorEnabled("auth_failure_spike")) {
    const baselineStart = startTimestamp - Math.floor(WINDOW_MS / 1000);
    const [current, baseline] = await Promise.all([
      authFailures(deps, orgId, projectId, startTimestamp, endTimestamp),
      authFailures(deps, orgId, projectId, baselineStart, startTimestamp),
    ]);
    for (const spike of detectAuthFailureSpikes(current, baseline)) {
      detected.push(await deps.persist({
        orgId, projectId, start, end,
        serviceName: spike.service,
        detector: "auth_failure_spike",
        type: "auth_failure_spike",
        severity: spike.severity,
        title: `Authentication failures spiking in ${spike.service}`,
        description: `${spike.count} requests were rejected with 401 or 403 in the last window, against ${spike.baseline} in the one before.`,
        observedValue: spike.count,
        threshold: Math.max(AUTH_FAILURE_MIN_COUNT, spike.baseline * AUTH_FAILURE_GROWTH_FACTOR),
        unit: "requests",
        evidence: [{
          kind: "metric",
          label: "auth-failures",
          value: spike.count,
          context: { service: spike.service, baseline: spike.baseline, status: "401,403" },
        }],
      }));
    }
  }

  if (detectorEnabled("secret_in_logs")) {
    for (const exposure of findSecretExposures(await recentLogs(deps, orgId, projectId, startTimestamp, endTimestamp))) {
      detected.push(await deps.persist({
        orgId, projectId, start, end,
        serviceName: exposure.service,
        detector: "secret_in_logs",
        type: "secret_in_logs",
        severity: "critical",
        title: `${exposure.kind} found in ${exposure.service} logs`,
        description: `${exposure.count} log lines contain what looks like this secret: ${exposure.kind}.`,
        observedValue: exposure.count,
        threshold: 0,
        unit: "log lines",
        fingerprint: exposure.kind,
        evidence: exposure.samples.map((sample) => ({
          kind: "log" as const,
          label: "redacted-sample",
          value: sample,
          context: { service: exposure.service, secretKind: exposure.kind },
        })),
      }));
    }
  }
  return detected;
}

async function authFailures(
  deps: DetectionStageDeps,
  orgId: string,
  projectId: string,
  from: number,
  to: number,
): Promise<AuthFailureCount[]> {
  return deps.cachedQuery("auth-failures", orgId, projectId, from, to, async () => {
    const result = await searchTenant<never>(deps.quickwit, "requests", { orgId, projectId }, {
      filter: AUTH_FAILURE_QUERY,
      startTimestamp: from,
      endTimestamp: to,
      maxHits: 0,
      aggregations: { services: { terms: { field: "service", size: 100 } } },
    });
    const buckets = (result.aggregations as { services?: { buckets?: Array<{ key: string; doc_count: number }> } } | undefined)?.services?.buckets ?? [];
    return buckets.map((bucket) => ({ service: bucket.key, count: bucket.doc_count }));
  });
}

async function recentLogs(
  deps: DetectionStageDeps,
  orgId: string,
  projectId: string,
  from: number,
  to: number,
): Promise<LogLine[]> {
  return deps.cachedQuery("secret-scan-logs", orgId, projectId, from, to, async () => {
    const result = await searchTenant<never>(deps.quickwit, "logs", { orgId, projectId }, {
      startTimestamp: from,
      endTimestamp: to,
      maxHits: SECRET_SCAN_MAX_LOGS,
    });
    return (result.hits ?? []).flatMap((hit) => {
      const source = quickwitSource<{ service?: string; message?: string; body?: string }>(hit);
      const message = source?.message ?? source?.body;
      return message ? [{ service: source?.service ?? "unknown", message }] : [];
    });
  });
}
