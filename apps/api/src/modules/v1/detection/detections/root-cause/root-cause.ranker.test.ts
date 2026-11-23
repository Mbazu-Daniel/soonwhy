
import { describe, it, expect } from 'vitest';
import { RootCauseRanker } from './root-cause.ranker';
import type { RankingInput } from "./root-cause.ranker.types";

describe('Root Cause Ranker', () => {
  const ranker = new RootCauseRanker();

  it('should rank database as root cause when slow', () => {
    const input: RankingInput = {
      findings: [
        {
          id: 'finding-1',
          type: 'database_latency',
          serviceName: 'postgres',
          timestamp: '2026-01-01T00:00:00Z',
          severity: 'critical',
          observedValue: 5000,
          baselineValue: 100,
        },
        {
          id: 'finding-2',
          type: 'latency',
          serviceName: 'api-service',
          timestamp: '2026-01-01T00:00:00Z',
          severity: 'warning',
          observedValue: 1000,
          baselineValue: 500,
        },
      ],
      dependencyMap: new Map([
        ['postgres', { upstream: [], downstream: ['api-service'] }],
        ['api-service', { upstream: ['postgres'], downstream: [] }],
      ]),
    };

    const result = ranker.rank(input);

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.serviceName).toBe('postgres');
    expect(result.candidates[0]?.score).toBeGreaterThan(result.candidates[1]?.score ?? 0);
  });

  it('should rank external API when slow', () => {
    const input: RankingInput = {
      findings: [
        {
          id: 'finding-1',
          type: 'dependency_latency',
          serviceName: 'external-api',
          timestamp: '2026-01-01T00:00:00Z',
          severity: 'critical',
          observedValue: 3000,
          baselineValue: 100,
        },
        {
          id: 'finding-2',
          type: 'latency',
          serviceName: 'api-service',
          timestamp: '2026-01-01T00:00:00Z',
          severity: 'warning',
          observedValue: 500,
          baselineValue: 300,
        },
      ],
      dependencyMap: new Map([
        ['external-api', { upstream: [], downstream: ['api-service'] }],
        ['api-service', { upstream: ['external-api'], downstream: [] }],
      ]),
    };

    const result = ranker.rank(input);

    expect(result.candidates[0]?.serviceName).toBe('external-api');
  });

  it('should handle missing trace data gracefully', () => {
    const input: RankingInput = {
      findings: [
        {
          id: 'finding-1',
          type: 'error_rate',
          serviceName: 'api-service',
          timestamp: '2026-01-01T00:00:00Z',
          severity: 'critical',
        },
      ],
    };

    const result = ranker.rank(input);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.limitations).toContain('Missing dependency graph data');
    expect(result.candidates[0]?.limitations).toContain('Missing trace data for critical-path analysis');
    expect(result.candidates[0]?.limitations).toContain('Missing error data for propagation analysis');
    expect(result.overallEvidenceCoverage).toBeLessThan(1);
  });

  it('should handle missing dependency data gracefully', () => {
    const input: RankingInput = {
      findings: [
        {
          id: 'finding-1',
          type: 'latency',
          serviceName: 'api-service',
          timestamp: '2026-01-01T00:00:00Z',
          observedValue: 1000,
          baselineValue: 500,
        },
      ],
    };

    const result = ranker.rank(input);

    expect(result.candidates[0]?.limitations).toContain('Missing dependency graph data');
    expect(result.candidates[0]?.limitations).toContain('Missing trace data for critical-path analysis');
    expect(result.candidates[0]?.limitations).toContain('Missing error data for propagation analysis');
  });

  it('should be deterministic for same input', () => {
    const input: RankingInput = {
      findings: [
        {
          id: 'finding-1',
          type: 'latency',
          serviceName: 'api-service',
          timestamp: '2026-01-01T00:00:00Z',
          observedValue: 1000,
          baselineValue: 500,
        },
      ],
    };

    const result1 = ranker.rank(input);
    const result2 = ranker.rank(input);

    expect(result1.candidates[0]?.score).toBe(result2.candidates[0]?.score);
    expect(result1.candidates[0]?.signalScores.anomalySeverity).toBe(result2.candidates[0]?.signalScores.anomalySeverity);
    expect(result1.candidates[0]?.signalScores.graphPosition).toBe(result2.candidates[0]?.signalScores.graphPosition);
  });

  it('should include evidence coverage in results', () => {
    const input: RankingInput = {
      findings: [
        {
          id: 'finding-1',
          type: 'latency',
          serviceName: 'api-service',
          timestamp: '2026-01-01T00:00:00Z',
          observedValue: 1000,
          baselineValue: 500,
        },
      ],
    };

    const result = ranker.rank(input);

    expect(result.overallEvidenceCoverage).toBeGreaterThanOrEqual(0);
    expect(result.overallEvidenceCoverage).toBeLessThanOrEqual(1);
  });

  describe('critical-path contribution uses self time when child spans are present', () => {
    const findings = ['caller', 'callee'].map((serviceName) => ({
      id: `f-${serviceName}`,
      type: 'latency',
      serviceName,
      timestamp: '2026-01-01T00:00:00Z',
      severity: 'critical' as const,
      observedValue: 1000,
      baselineValue: 100,
    }));

    const criticalPathScore = (traces: NonNullable<RankingInput['traces']>, service: string) =>
      ranker.rank({ findings, traces }).candidates.find((c) => c.serviceName === service)?.signalScores
        .criticalPathContribution ?? 0;

    it('does not credit a caller with time spent waiting on its callee', () => {
      const trace = [
        { spanId: 'a', serviceName: 'caller', duration: 1000, startTime: 0, isCriticalPath: true },
        { spanId: 'b', serviceName: 'callee', duration: 900, startTime: 50, parentSpanId: 'a', isCriticalPath: true },
      ];
      expect(criticalPathScore([trace], 'callee')).toBeGreaterThan(criticalPathScore([trace], 'caller'));
      expect(criticalPathScore([trace], 'caller')).toBeCloseTo(0.2, 5);
    });

    it('counts overlapping children once', () => {
      const trace = [
        { spanId: 'a', serviceName: 'caller', duration: 1000, startTime: 0 },
        { spanId: 'b', serviceName: 'callee', duration: 600, startTime: 100, parentSpanId: 'a' },
        { spanId: 'c', serviceName: 'callee', duration: 600, startTime: 200, parentSpanId: 'a' },
      ];
      expect(criticalPathScore([trace], 'caller')).toBeCloseTo(0.3, 5);
    });

    it('keeps inclusive duration when no child spans are in the trace', () => {
      const trace = [{ spanId: 'a', serviceName: 'caller', duration: 1000, startTime: 0 }];
      expect(criticalPathScore([trace], 'caller')).toBeCloseTo(1, 5);
    });
  });
});

describe('error propagation when traces were inspected', () => {
  const finding = { id: 'f', type: 'latency', serviceName: 'db', timestamp: '2026-01-01T00:00:00Z', severity: 'critical' as const, observedValue: 900, baselineValue: 100 };
  const traceWith = (service: string) => [[{ spanId: 's', serviceName: service, duration: 100, startTime: 0 }]];

  it('reports no errors in a trace that contains the candidate as an observed zero, not a missing signal', () => {
    const ranker = new RootCauseRanker();
    const missing = ranker.rank({ findings: [finding] });
    const observed = ranker.rank({ findings: [finding], traces: traceWith('db') });
    expect(missing.candidates[0]?.signalScores.errorPropagation).toBeUndefined();
    expect(observed.candidates[0]?.signalScores.errorPropagation).toBe(0);
  });

  it('keeps the signal absent when no loaded trace contains the candidate', () => {
    const ranker = new RootCauseRanker();
    const result = ranker.rank({ findings: [finding], traces: traceWith('other') });
    expect(result.candidates[0]?.signalScores.errorPropagation).toBeUndefined();
  });
});

describe('confidence when the trace data is unreliable', () => {
  const ranker = new RootCauseRanker();
  const findings: RankingInput['findings'] = [
    { id: 'f1', type: 'latency', serviceName: 'db', timestamp: '2026-01-01T00:00:00Z', severity: 'critical', observedValue: 5000, baselineValue: 100 },
  ];
  const span = (spanId: string, parentSpanId: string | undefined, startTime: number, duration: number) => ({
    traceId: 't', spanId, parentSpanId, serviceName: 'db', startTime, duration,
  });

  it('lowers the tier and says why when most parents are missing', () => {
    const intact = ranker.rank({ findings, traces: [[span('a', undefined, 0, 100), span('b', 'a', 10, 50)]] });
    const broken = ranker.rank({ findings, traces: [[span('a', undefined, 0, 100), span('b', 'x', 10, 50), span('c', 'y', 10, 5)]] });

    expect(broken.candidates[0]!.score).toBeCloseTo(intact.candidates[0]!.score, 1);
    expect(broken.confidence).not.toBe(intact.confidence);
    expect(broken.limitations.join(' ')).toMatch(/unreliable/);
    expect(intact.limitations.join(' ')).not.toMatch(/unreliable/);
  });

  it('adjusts for disagreeing service clocks instead of calling the data unreliable', () => {
    const trace = (n: number, orders: number) => [
      { traceId: `t${n}`, spanId: `g${n}`, serviceName: 'gateway', startTime: n * 1000, duration: 400 },
      { traceId: `t${n}`, spanId: `o${n}`, parentSpanId: `g${n}`, serviceName: 'orders', startTime: n * 1000 + 20 + orders, duration: 300 },
    ];
    const result = ranker.rank({ findings: [{ ...findings[0]!, serviceName: 'orders' }], traces: [1, 2, 3, 4].map((n) => trace(n, 700)) });

    expect(result.limitations.join(' ')).toMatch(/clocks disagreed/);
    expect(result.limitations.join(' ')).not.toMatch(/unreliable/);
  });
});
