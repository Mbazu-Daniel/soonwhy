import { describe, expect, it } from 'vitest';
import { createIssueFromDetection } from './detection-issue.adapter';
import type { DetectionFinding } from '../detections/detection.types';

const finding: DetectionFinding = {
  id: 'finding-1',
  projectId: 'project-1',
  serviceName: 'api',
  type: 'dependency_latency',
  severity: 'critical',
  title: 'Slow database dependency in api',
  description: 'Database latency increased.',
  observedValue: 900,
  threshold: 500,
  unit: 'ms',
  window: {
    start: new Date('2026-09-28T10:00:00Z'),
    end: new Date('2026-09-28T10:15:00Z'),
  },
  evidence: [{
    kind: 'trace',
    label: 'slow-dependency-span',
    value: 900,
    context: {
      dependencyType: 'database',
      dependencyName: 'postgres',
      timestamp: '2026-09-28T10:12:00Z',
    },
  }],
};

describe('createIssueFromDetection', () => {
  it('creates a stable dependency identity from finding context', () => {
    const first = createIssueFromDetection(finding);
    const second = createIssueFromDetection(finding);

    expect(first.identity).toEqual(second.identity);
    expect(first.identity.domain).toBe('dependency');
    expect(first.identity.serviceName).toBe('api');
    expect(first.identity.operationName).toBe('dependency_latency');
    expect(first.identity.fingerprint).toBeTruthy();
  });

  it('turns detection evidence into confidence observations', () => {
    const issue = createIssueFromDetection(finding);

    expect(issue.observations).toHaveLength(2);
    expect(issue.observations[1]).toMatchObject({
      name: 'slow-dependency-span',
      source: 'trace',
      observedAt: '2026-09-28T10:12:00Z',
    });
    expect(issue.windows).toEqual([{
      start: '2026-09-28T10:00:00.000Z',
      end: '2026-09-28T10:15:00.000Z',
    }]);
    expect(issue.confidence.identity).toEqual(issue.identity);
  });
});
