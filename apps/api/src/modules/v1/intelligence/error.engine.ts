import { createHash } from 'node:crypto';

export interface ErrorEvent {
  serviceName: string;
  endpoint?: string;
  traceId: string;
  timestamp: string;
  exceptionType?: string;
  message: string;
  stack?: string;
}

export interface ErrorWindow {
  errorCount: number;
  requestCount: number;
  affectedTraceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ErrorBaseline {
  errorCount: number;
  requestCount: number;
}

export interface ErrorSignal {
  severity: 'warning' | 'critical';
  fingerprint: string;
  errorRate: number;
  errorCount: number;
  affectedTraceCount: number;
  errorRateChangePercent?: number;
  countChangePercent?: number;
  firstSeenAt: string;
  lastSeenAt: string;
  identity: {
    exceptionType?: string;
    normalizedMessage: string;
    stackFrame?: string;
  };
}

const WARNING_ERROR_RATE = 0.05;
const CRITICAL_ERROR_RATE = 0.10;
const WARNING_ERROR_COUNT = 10;
const CRITICAL_ERROR_COUNT = 100;
const REGRESSION_PERCENT = 100;

export function fingerprintError(event: Pick<ErrorEvent, 'exceptionType' | 'message' | 'stack'>): ErrorSignal['identity'] & { fingerprint: string } {
  const normalizedMessage = normalizeMessage(event.message);
  const stackFrame = topApplicationFrame(event.stack);
  const identity = {
    ...(event.exceptionType ? { exceptionType: normalizeToken(event.exceptionType) } : {}),
    normalizedMessage,
    ...(stackFrame ? { stackFrame } : {}),
  };
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(identity))
    .digest('hex')
    .slice(0, 24);

  return { ...identity, fingerprint };
}

export function evaluateErrorSignal(
  events: ErrorEvent[],
  window: ErrorWindow,
  baseline?: ErrorBaseline,
): ErrorSignal | undefined {
  if (window.requestCount <= 0 || window.errorCount <= 0 || events.length === 0) return undefined;

  const first = events[0]!;
  const identity = fingerprintError(first);
  const errorRate = window.errorCount / window.requestCount;
  const errorRateChangePercent = baseline
    ? percentChange(errorRate, baseline.errorCount / Math.max(1, baseline.requestCount))
    : undefined;
  const countChangePercent = baseline
    ? percentChange(window.errorCount, baseline.errorCount)
    : undefined;

  const elevated =
    errorRate >= WARNING_ERROR_RATE ||
    window.errorCount >= WARNING_ERROR_COUNT ||
    (errorRateChangePercent !== undefined && errorRateChangePercent >= REGRESSION_PERCENT);

  if (!elevated) return undefined;

  const critical =
    errorRate >= CRITICAL_ERROR_RATE ||
    window.errorCount >= CRITICAL_ERROR_COUNT ||
    (errorRateChangePercent !== undefined && errorRateChangePercent >= REGRESSION_PERCENT * 2);

  return {
    severity: critical ? 'critical' : 'warning',
    fingerprint: identity.fingerprint,
    errorRate,
    errorCount: window.errorCount,
    affectedTraceCount: window.affectedTraceCount,
    ...(errorRateChangePercent !== undefined ? { errorRateChangePercent } : {}),
    ...(countChangePercent !== undefined ? { countChangePercent } : {}),
    firstSeenAt: window.firstSeenAt,
    lastSeenAt: window.lastSeenAt,
    identity,
  };
}

function normalizeMessage(message: string): string {
  return message
    .trim()
    .replace(/https?:\/\/\S+/gi, '<url>')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<uuid>')
    .replace(/\b\d+(?:\.\d+)?\b/g, '<number>')
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}

function normalizeToken(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 200);
}

function topApplicationFrame(stack?: string): string | undefined {
  if (!stack) return undefined;
  const frame = stack
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('at ') && !line.includes('node_modules/'));
  return frame?.slice(0, 300);
}

function percentChange(current: number, baseline: number): number | undefined {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0) return undefined;
  return ((current - baseline) / baseline) * 100;
}
