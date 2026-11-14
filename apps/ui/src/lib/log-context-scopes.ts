import type { LogContextScope, LogEntry } from '~/lib/log-types';

const ATTRIBUTE_SCOPES: Array<{ key: string; label: string }> = [
  { key: 'k8s.pod.name', label: 'pod' },
  { key: 'host.name', label: 'host' },
  { key: 'container.id', label: 'container' },
];

export function contextScopes(log: Pick<LogEntry, 'service' | 'traceId'>, attributes: Record<string, unknown>): LogContextScope[] {
  const scopes: LogContextScope[] = [];
  if (log.service) scopes.push({ label: 'service', field: 'service', value: log.service });
  for (const { key, label } of ATTRIBUTE_SCOPES) {
    const value = attributes[key];
    if (typeof value === 'string' && value) scopes.push({ label, field: `attributes.${key}`, value });
  }
  if (log.traceId) scopes.push({ label: 'trace', field: 'traceId', value: log.traceId });
  return scopes;
}
