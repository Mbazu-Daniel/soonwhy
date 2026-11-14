import { describe, expect, it } from 'vitest';
import { contextScopes } from './log-context-scopes';

describe('contextScopes', () => {
  it('offers service, pod, host, container and trace when the log has them', () => {
    const scopes = contextScopes({ service: 'api', traceId: 't1' }, { 'host.name': 'box-1', 'k8s.pod.name': 'api-7f', 'container.id': 'abc', other: 'x' });
    expect(scopes.map((scope) => `${scope.label}:${scope.field}=${scope.value}`)).toEqual([
      'service:service=api', 'pod:attributes.k8s.pod.name=api-7f', 'host:attributes.host.name=box-1', 'container:attributes.container.id=abc', 'trace:traceId=t1',
    ]);
  });

  it('skips scopes the log does not have', () => {
    expect(contextScopes({ service: 'api' }, { 'host.name': 5 })).toEqual([{ label: 'service', field: 'service', value: 'api' }]);
  });
});
