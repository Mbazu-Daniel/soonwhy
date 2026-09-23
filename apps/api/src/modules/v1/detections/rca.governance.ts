import { Injectable } from '@nestjs/common';
import type { RcaAnalysis, RcaUsage } from './rca.types';
import { db } from '../../../common/db';
import { rcaInvocations } from '../../../common/db/schema';
import { generateId } from '../../../common/db/generate-id';

export type RcaInvocationStatus = 'succeeded' | 'failed';

export interface RcaInvocationRecord {
  id: string;
  orgId: string;
  projectId: string;
  findingId: string;
  status: RcaInvocationStatus;
  provider: string;
  model: string;
  promptVersion: string;
  requestDurationMs: number;
  retries: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  errorCode?: string;
  createdAt: Date;
}

export interface RcaGovernanceSink {
  recordSuccess(input: Omit<RcaInvocationRecord, 'id' | 'status' | 'createdAt' | 'errorCode'>): Promise<void>;
  recordFailure(input: Omit<RcaInvocationRecord, 'id' | 'status' | 'createdAt'> & { errorCode?: string }): Promise<void>;
}

@Injectable()
export class DatabaseRcaGovernanceSink implements RcaGovernanceSink {
  async recordSuccess(input: Omit<RcaInvocationRecord, 'id' | 'status' | 'createdAt' | 'errorCode'>): Promise<void> {
    await db.insert(rcaInvocations).values({ id: generateId(), ...input, status: 'succeeded' });
  }
  async recordFailure(input: Omit<RcaInvocationRecord, 'id' | 'status' | 'createdAt'> & { errorCode?: string }): Promise<void> {
    await db.insert(rcaInvocations).values({ id: generateId(), ...input, status: 'failed' });
  }
}

export class NoopRcaGovernanceSink implements RcaGovernanceSink {
  async recordSuccess(): Promise<void> {}
  async recordFailure(): Promise<void> {}
}

export function toRcaUsageFields(usage: RcaUsage) {
  return {
    requestDurationMs: usage.requestDurationMs,
    retries: usage.retries,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
  };
}

export function getRcaErrorCode(error: unknown): string {
  if (error instanceof Error) return error.name;
  return 'UnknownError';
}

export function isRcaAnalysis(value: unknown): value is RcaAnalysis {
  return !!value && typeof value === 'object' && 'summary' in value && 'rootCause' in value;
}
