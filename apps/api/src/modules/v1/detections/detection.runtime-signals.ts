import { QUICKWIT_INDEXES } from '@soonwhy/shared';
import { quickwitSource, quickwitTenantQuery, quickwitTerm } from '../../../common/quickwit/query';
import { detectRuntimeDegradation, RUNTIME_METRIC_NAMES, type RuntimeMetricSample } from '../intelligence/runtime-degradation.detector';
import { WINDOW_MS, type DetectionStageContext, type DetectionStageDeps } from './detection.stage';
import type { DetectionFinding, TraceSource } from './detection.types';

export async function detectRuntimeSignals(
  deps: DetectionStageDeps,
  context: DetectionStageContext,
  detected: DetectionFinding[],
): Promise<void> {
  const {
    orgId, projectId, start, end, startTimestamp, endTimestamp,
    detectorEnabled,
  } = context;
  const enabledRuntime = detectorEnabled('runtime_degradation');
  const [runtimeMetrics, baselineRuntimeMetrics] = enabledRuntime
    ? await Promise.all([
      cachedRuntimeMetrics(deps, orgId, projectId, startTimestamp, endTimestamp),
      cachedRuntimeMetrics(deps, 
        orgId,
        projectId,
        startTimestamp - Math.floor(WINDOW_MS / 1000),
        startTimestamp,
      ),
    ])
    : [[], []] as unknown as [RuntimeMetricSample[], RuntimeMetricSample[]];

  for (const candidate of enabledRuntime ? detectRuntimeDegradation(runtimeMetrics, baselineRuntimeMetrics) : []) {
    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'runtime_degradation',
      type: 'runtime_degradation',
      severity: candidate.signal.severity,
      title: 'Runtime saturation in ' + candidate.serviceName,
      description: candidate.metricName + ' reached a p95 of ' +
        candidate.signal.p95.toFixed(3) + ' ' + candidate.unit +
        ' across ' + candidate.signal.sampleCount + ' samples.',
      observedValue: candidate.signal.p95,
      threshold: candidate.signal.threshold,
      unit: candidate.unit,
      start,
      end,
      evidence: [
        ...candidate.samples.map((sample) => ({
          kind: 'metric' as const,
          label: 'runtime-metric',
          value: sample.value,
          context: {
            service: sample.service,
            metricName: sample.name,
            timestamp: sample.timestamp,
          },
        })),
        {
          kind: 'metric' as const,
          label: 'runtime-profile',
          value: candidate.signal.p95,
          context: {
            metricName: candidate.metricName,
            runtimeFamily: candidate.family,
            sampleCount: candidate.signal.sampleCount,
            p50: candidate.signal.p50,
            p95: candidate.signal.p95,
            p99: candidate.signal.p99,
            threshold: candidate.signal.threshold,
            severity: candidate.signal.severity,
            ...(candidate.signal.baselineP95 !== undefined
              ? { baselineP95: candidate.signal.baselineP95 }
              : {}),
            ...(candidate.signal.p95ChangePercent !== undefined
              ? { p95ChangePercent: candidate.signal.p95ChangePercent }
              : {}),
            fingerprint: candidate.identity.fingerprint,
            fingerprintVersion: candidate.identity.fingerprintVersion,
          },
        },
        {
          kind: 'recommendation' as const,
          label: 'runtime-guidance',
          value: candidate.recommendation,
          context: {
            metricName: candidate.metricName,
            runtimeFamily: candidate.family,
          },
        },
      ],
    }));
  }}

async function cachedRuntimeMetrics(
  deps: DetectionStageDeps,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<RuntimeMetricSample[]> {
  return deps.cachedQuery('runtime-metrics', orgId, projectId, startTimestamp, endTimestamp, async () => {
  const names = RUNTIME_METRIC_NAMES
    .map((name) => quickwitTerm('name', name))
    .join(' OR ');
  const result = await deps.quickwit.search<never>(QUICKWIT_INDEXES.metrics, {
    query: quickwitTenantQuery(orgId, projectId, names),
    startTimestamp,
    endTimestamp,
    maxHits: 5000,
    sortBy: ['timestamp'],
  });

  return (result.hits ?? []).flatMap((hit) => {
    const source = quickwitSource<TraceSource>(hit) as unknown as {
      timestamp?: string;
      service?: string;
      name?: string;
      value?: number;
    };
    const value = Number(source?.value);
    if (!source?.timestamp || !source.service || !source.name || !Number.isFinite(value)) {
      return [];
    }

    return [{
      timestamp: source.timestamp,
      service: source.service,
      name: source.name,
      value,
    }];
  });
  });
}
