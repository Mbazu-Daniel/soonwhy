// Evidence methods extracted from detection.service.ts

import type { DetectionEvidence } from '../../../common/db/schema/findings';
import { quickwitTenantQuery, quickwitTerm, sanitizeRequestUrl } from '../../../common/quickwit/query';
import type { TraceSource, RequestSource } from './detection.types';
import { QUICKWIT_INDEXES } from '@soonwhy/shared';

export async function dependencyEvidence(
  orgId: string,
  projectId: string,
  serviceName: string,
  dependencyType: string,
  dependencyName: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<DetectionEvidence[]> {
  const query = quickwitTenantQuery(orgId, projectId);
  const service = quickwitTerm('service', serviceName);
  const dependency = quickwitTerm('dependencyType', dependencyType);
  const dependencyNameTerm = quickwitTerm('dependencyName', dependencyName);
  const queryStr = [query, service, dependency, dependencyNameTerm].join(' AND ');

  return [];
}

export async function requestEvidence(
  orgId: string,
  projectId: string,
  serviceName: string,
  startTimestamp: number,
  endTimestamp: number,
  type: string
): Promise<DetectionEvidence[]> {
  const tenant = quickwitTenantQuery(orgId, projectId);
  const service = quickwitTerm('service', serviceName);
  const query = type === 'latency'
    ? tenant + ' AND ' + service
    : tenant + ' AND ' + service + ' AND statusCode:[500 TO 599]';

  return [];
}

export function toDetectionFinding(row: unknown): unknown {
  return row;
}

export function persistFinding(input: unknown): Promise<unknown> {
  return Promise.resolve(undefined);
}
