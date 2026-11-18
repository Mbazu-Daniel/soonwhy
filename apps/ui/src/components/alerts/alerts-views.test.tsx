import { describe, expect, it } from 'vitest';
import { AlertHistoryPanel } from '~/components/alerts/alert-history-panel';
import type { AlertRule, NotificationLog, NotificationLogPage } from '~/lib/types';
import { newQueryClient, renderHtml } from '~/test-utils/render-html';

const rules = [{ id: 'r1', name: 'High error rate' }] as AlertRule[];

function log(partial: Partial<NotificationLog> & Pick<NotificationLog, 'id'>): NotificationLog {
  return {
    channelType: 'slack',
    incidentId: null,
    alertRuleId: null,
    status: 'sent',
    error: null,
    title: null,
    createdAt: '2026-11-18T10:00:00Z',
    ...partial,
  };
}

function withLogs(items: NotificationLog[], hasMore = false) {
  const client = newQueryClient();
  const page: NotificationLogPage = { items, limit: 25, offset: 0, hasMore };
  client.setQueryData(['notification-logs', 'p1', 0], page);
  return client;
}

describe('AlertHistoryPanel', () => {
  it('explains the empty state', () => {
    const html = renderHtml(<AlertHistoryPanel projectId="p1" rules={rules} />, withLogs([]));
    expect(html).toContain('No alert deliveries yet');
  });

  it('names a delivery after its rule when it has no title', () => {
    const html = renderHtml(
      <AlertHistoryPanel projectId="p1" rules={rules} />,
      withLogs([log({ id: 'l1', alertRuleId: 'r1' })]),
    );
    expect(html).toContain('High error rate');
    expect(html).toContain('slack');
  });

  it('prefers the delivery title, then falls back to Alert', () => {
    const html = renderHtml(
      <AlertHistoryPanel projectId="p1" rules={rules} />,
      withLogs([log({ id: 'l1', title: 'Checkout down', alertRuleId: 'r1' }), log({ id: 'l2', alertRuleId: 'gone' })]),
    );
    expect(html).toContain('Checkout down');
    expect(html).not.toContain('High error rate');
    expect(html).toContain('>Alert<');
  });

  it('shows failed deliveries with their error', () => {
    const html = renderHtml(
      <AlertHistoryPanel projectId="p1" rules={rules} />,
      withLogs([log({ id: 'l1', status: 'failed', error: 'webhook returned 500', channelType: 'webhook' })]),
    );
    expect(html).toContain('failed');
    expect(html).toContain('webhook returned 500');
    expect(html).toContain('text-[#F2555A]');
  });

  it('disables Previous on the first page and Next when there is no more', () => {
    const html = renderHtml(<AlertHistoryPanel projectId="p1" rules={rules} />, withLogs([log({ id: 'l1' })]));
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it('enables Next when more pages exist', () => {
    const html = renderHtml(<AlertHistoryPanel projectId="p1" rules={rules} />, withLogs([log({ id: 'l1' })], true));
    expect(html.match(/disabled=""/g)).toHaveLength(1);
  });
});
