import { eq } from 'drizzle-orm';
import { QUICKWIT_INDEXES } from '@soonwhy/shared';
import { db } from '../../../common/db';
import { deployments, services } from '../../../common/db/schema';
import { quickwitTenantQuery } from '../../../common/quickwit/query';
import { evaluateTraceSpan } from './detection.engine';
import { correlateFindings, type DeploymentInfo } from './detection.correlation';
import type { DetectionStageContext, DetectionStageDeps } from './detection.stage';
import type { DetectionFinding, TraceSource } from './detection.types';

export async function detectTraceSignals(
  deps: DetectionStageDeps,
  context: DetectionStageContext,
  detected: DetectionFinding[],
): Promise<void> {
  const {
    orgId, projectId, start, end, startTimestamp, endTimestamp,
    settings, detectorEnabled,
  } = context;
  const enabledBottleneck =
    detectorEnabled('bottleneck') &&
    deps.detectorSettings.featureEnabled(settings, 'detections.correlation');
  const traceSpans = detectorEnabled('trace_span')
    ? await cachedTraceSpanCandidates(deps, 
      orgId,
      projectId,
      startTimestamp,
      endTimestamp,
    )
    : [];
  const deploymentsFromDb = enabledBottleneck
    ? await db
      .select({
        id: deployments.id,
        version: deployments.version,
        deployedAt: deployments.deployedAt,
        serviceName: services.name,
      })
      .from(deployments)
      .innerJoin(services, eq(deployments.serviceId, services.id))
      .where(eq(services.projectId, projectId))
    : [];
  const deploymentInfos: DeploymentInfo[] = deploymentsFromDb.map((d) => ({
    deploymentId: d.id,
    version: d.version ?? '',
    deployedAt: d.deployedAt ?? new Date(0),
    serviceName: d.serviceName,
  }));

  for (const candidate of traceSpans) {
    const signal = evaluateTraceSpan(candidate.spanDuration, candidate.traceDuration);
    if (!signal) continue;

    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: candidate.serviceName,
      detector: 'trace_span',
      type: signal.type,
      severity: signal.severity,
      title: 'Span dominates trace latency in ' + candidate.serviceName,
      description:
        candidate.spanName +
        ' accounts for ' +
        signal.observedValue.toFixed(0) +
        '% of the trace duration.',
      observedValue: signal.observedValue,
      threshold: signal.threshold,
      unit: signal.unit,
      start,
      end,
      evidence: [
        {
          kind: 'trace',
          label: 'dominant-span',
          value: candidate.spanDuration,
          context: {
            traceId: candidate.traceId,
            spanId: candidate.spanId,
            spanName: candidate.spanName,
            traceDurationMs: candidate.traceDuration,
            contributionPercent: signal.observedValue,
          },
        },
      ],
    }));
  }

  const correlated = enabledBottleneck ? correlateFindings(detected, deploymentInfos) : [];

  for (const bottleneck of correlated) {
    const dependencyDescription = bottleneck.dependencyName
      ? ' The correlated dependency is ' + bottleneck.dependencyName + '.'
      : '';
    const supportingTypes = bottleneck.supportingFindings
      .map((finding) => finding.type)
      .filter((type, index, types) => types.indexOf(type) === index)
      .join(', ');

    detected.push(await deps.persist({
      orgId,
      projectId,
      serviceName: bottleneck.serviceName,
      detector: 'bottleneck',
      type: 'bottleneck',
      severity: bottleneck.supportingFindings.some((finding) => finding.severity === 'critical')
        ? 'critical'
        : bottleneck.latency.severity,
      title: 'Correlated bottleneck in ' + bottleneck.serviceName,
      description:
        'Request latency is correlated with ' +
        supportingTypes +
        '.' +
        dependencyDescription +
        ' The evidence points to the dependency or operation captured in the trace rather than the API boundary alone.',
      observedValue: bottleneck.latency.observedValue,
      threshold: bottleneck.latency.threshold,
      unit: bottleneck.latency.unit,
      start,
      end,
      evidence: [
        {
          kind: 'metric',
          label: 'correlated-signal',
          value: bottleneck.latency.observedValue,
          context: {
            service: bottleneck.serviceName,
            sourceFindingId: bottleneck.latency.id,
            sourceFindingType: bottleneck.latency.type,
          },
        },
        ...bottleneck.supportingFindings.map((finding) => ({
          kind: 'metric' as const,
          label: 'supporting-finding',
          value: finding.observedValue,
          context: {
            findingId: finding.id,
            findingType: finding.type,
            severity: finding.severity,
            service: finding.serviceName,
          },
        })),
        ...bottleneck.traceIds.map((traceId) => ({
          kind: 'trace' as const,
          label: 'correlated-trace',
          value: traceId,
          context: {
            traceId,
            service: bottleneck.serviceName,
          },
        })),
        {
          kind: 'recommendation',
          label: 'optimization-guidance',
          value: bottleneck.recommendation,
          context: {
            dependencyType: bottleneck.dependencyType ?? null,
            dependencyName: bottleneck.dependencyName ?? null,
            source: 'deterministic-correlation',
          },
        },
      ],
    }));
  }
}

async function cachedTraceSpanCandidates(
  deps: DetectionStageDeps,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<Array<{
  traceId: string;
  spanId: string;
  spanName: string;
  serviceName: string;
  spanDuration: number;
  traceDuration: number;
}>> {
  return deps.cachedQuery('trace-span-candidates', orgId, projectId, startTimestamp, endTimestamp, async () => {
  const result = await deps.quickwit.search<TraceSource>(QUICKWIT_INDEXES.traces, {
    query: quickwitTenantQuery(orgId, projectId),
    startTimestamp,
    endTimestamp,
    maxHits: 5000,
    sortBy: ['-duration'],
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
      rootService: String(source.service ?? ''),
      spans: [],
    };
    trace.spans.push(source);

    const startMs = new Date(String(source.timestamp ?? '')).getTime();
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
      .map((span) => new Date(String(span.timestamp ?? '')).getTime())
      .filter(Number.isFinite);
    if (!starts.length || trace.duration <= Math.min(...starts)) return [];

    const traceDuration = trace.duration - Math.min(...starts);
    const candidate = trace.spans
      .filter((span) => Number(span.duration ?? 0) > 0)
      .sort((a, b) => Number(b.duration ?? 0) - Number(a.duration ?? 0))[0];

    if (!candidate) return [];

    return [{
      traceId,
      spanId: String(candidate.spanId ?? ''),
      spanName: String(candidate.name ?? ''),
      serviceName: String(candidate.service ?? trace.rootService),
      spanDuration: Number(candidate.duration ?? 0),
      traceDuration,
    }];
  });
  });
}
