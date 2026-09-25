import { describe, expect, it } from 'vitest';
import { getRcaErrorCode, toRcaUsageFields } from './rca.governance';

describe('RCA governance', () => {
  it('normalizes provider usage into invocation fields', () => {
    expect(toRcaUsageFields({ requestDurationMs: 42, retries: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCostUsd: 0.02 })).toEqual({
      requestDurationMs: 42, retries: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCostUsd: 0.02,
    });
  });
  it('uses stable error names without exposing provider error payloads', () => {
    expect(getRcaErrorCode(new TypeError('secret provider body'))).toBe('TypeError');
    expect(getRcaErrorCode('bad')).toBe('UnknownError');
  });
});
