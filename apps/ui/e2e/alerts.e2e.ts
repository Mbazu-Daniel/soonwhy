import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mock-api';

const PAGE = '/acme/p/web/alerts';

const RULE = {
  id: 'rule-1',
  orgId: 'org-1',
  projectId: 'proj-1',
  name: 'High error rate',
  description: 'Errors above 5 percent',
  conditions: [{ type: 'metric', metric: 'error_rate', operator: 'gt', value: 5, window: '5m' }],
  minSeverity: 'high',
  channelIds: [],
  status: 'active',
  dedupeWindowSeconds: 300,
  createdAt: '2026-11-01T00:00:00Z',
};

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mockAlerts(page: Page, rules: unknown[]) {
  await mockApi(page);
  await page.route((url) => url.pathname.endsWith('/notifications/alert-rules'), (route) => route.fulfill(json(rules)));
}

test.describe('alerts', () => {
  test('explains the empty state and offers to create a rule', async ({ page }) => {
    await mockAlerts(page, []);
    await page.goto(PAGE);
    await expect(page.getByText('No alert rules yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create alert rule' })).toBeVisible();
  });

  test('lists a rule with its severity, status and condition', async ({ page }) => {
    await mockAlerts(page, [RULE]);
    await page.goto(PAGE);
    await expect(page.getByText('High error rate')).toBeVisible();
    await expect(page.getByText('Errors above 5 percent')).toBeVisible();
    await expect(page.getByText('high', { exact: true })).toBeVisible();
    await expect(page.getByText('active', { exact: true })).toBeVisible();
    await expect(page.getByText(/> 5 \/ 5m/)).toBeVisible();
  });

  test('deletes a rule after the confirmation', async ({ page }) => {
    await mockAlerts(page, [RULE]);
    const deletes: string[] = [];
    await page.route((url) => url.pathname.endsWith('/alert-rules/rule-1'), (route) => {
      deletes.push(route.request().method());
      return route.fulfill(json({}));
    });
    page.once('dialog', (dialog) => void dialog.accept());
    await page.goto(PAGE);

    await page.getByRole('button', { name: 'Delete High error rate' }).click();
    await expect.poll(() => deletes).toEqual(['DELETE']);
  });

  test('keeps the rule when the confirmation is declined', async ({ page }) => {
    await mockAlerts(page, [RULE]);
    const deletes: string[] = [];
    await page.route((url) => url.pathname.endsWith('/alert-rules/rule-1'), (route) => {
      deletes.push(route.request().method());
      return route.fulfill(json({}));
    });
    page.once('dialog', (dialog) => void dialog.dismiss());
    await page.goto(PAGE);

    await page.getByRole('button', { name: 'Delete High error rate' }).click();
    await page.waitForTimeout(300);
    expect(deletes).toEqual([]);
  });

  test('opens the rule form from the edit button', async ({ page }) => {
    await mockAlerts(page, [RULE]);
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Edit High error rate' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('shows delivery history, including a failed delivery', async ({ page }) => {
    await mockAlerts(page, [RULE]);
    await page.route((url) => url.pathname.endsWith('/notifications/logs'), (route) =>
      route.fulfill(json({
        items: [
          { id: 'l1', channelType: 'slack', incidentId: null, alertRuleId: 'rule-1', status: 'sent', error: null, title: null, createdAt: '2026-11-18T10:00:00Z' },
          { id: 'l2', channelType: 'webhook', incidentId: null, alertRuleId: 'rule-1', status: 'failed', error: 'webhook returned 500', title: 'Checkout down', createdAt: '2026-11-18T10:05:00Z' },
        ],
        limit: 25,
        offset: 0,
        hasMore: false,
      })),
    );
    await page.goto(PAGE);
    await page.getByRole('tab', { name: 'History' }).click();

    await expect(page.getByText('Checkout down')).toBeVisible();
    await expect(page.getByText('webhook returned 500')).toBeVisible();
    await expect(page.getByText('failed', { exact: true })).toBeVisible();
  });

  test('shows a retry state when the rules request fails', async ({ page }) => {
    await mockApi(page);
    await page.route((url) => url.pathname.endsWith('/notifications/alert-rules'), (route) => route.fulfill(json({ message: 'boom' }, 500)));
    await page.goto(PAGE);
    await expect(page.getByRole('alert')).toContainText('Unable to load this view');
  });
});
