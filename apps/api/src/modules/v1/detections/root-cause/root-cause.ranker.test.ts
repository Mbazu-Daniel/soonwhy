
import { describe, it, expect } from 'vitest';
import { RootCauseRanker } from './root-cause.ranker';
import type { RankingInput } from './root-cause.ranker';

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
});
