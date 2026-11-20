import { expect as baseExpect, test, type Page } from '@playwright/test';
import { mockApi } from './mock-api';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 90_000 });

const PAGE = '/acme/p/web/intelligence';
const NOW = new Date('2026-05-01T12:00:00.000Z').toISOString();

function finding(overrides: Record<string, unknown>) {
  return {
    id: 'f-1', projectId: 'proj-1', serviceName: 'checkout-api', type: 'latency', severity: 'critical',
    title: 'Slow checkout', description: 'p95 is high', observedValue: 1900, threshold: 500, unit: 'ms',
    windowStart: NOW, windowEnd: NOW, evidence: [], category: 'performance', status: 'open', occurrences: 3,
    lastSeenAt: NOW, resolvedAt: null, recommendation: 'Fix the slowest span first.', ...overrides,
  };
}

const OPEN = [
  finding({}),
  finding({ id: 'f-2', type: 'secret_in_logs', category: 'security', title: 'AWS access key found in auth-api logs', recommendation: 'Rotate the exposed credential now.' }),
  finding({ id: 'f-3', type: 'error_group', category: 'error', severity: 'warning', title: 'TypeError in checkout-api' }),
];
const RESOLVED = [finding({ id: 'f-4', status: 'resolved', resolvedAt: NOW, title: 'Old slow query' })];

const REPORT = {
  period: { from: NOW, to: NOW },
  totals: { open: 3, openCritical: 2, ignored: 0, newInPeriod: 4, resolvedInPeriod: 1 },
  byCategory: [
    { category: 'error', open: 1, resolved: 0, ignored: 0 },
    { category: 'performance', open: 1, resolved: 1, ignored: 0 },
    { category: 'security', open: 1, resolved: 0, ignored: 0 },
    { category: 'vulnerability', open: 0, resolved: 0, ignored: 0 },
  ],
  topOpen: [], resolved: [], services: [{ serviceName: 'checkout-api', open: 3 }], markdown: '# Findings report',
};

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

const api = (match: (path: string) => boolean) => (url: URL) => url.pathname.startsWith('/api/v1/') && match(url.pathname);

async function mockFindings(page: Page) {
  const patches: unknown[] = [];
  await mockApi(page);
  await page.route(api((path) => path.endsWith('/dependencies')), (route) =>
    route.fulfill(json([{ id: 'd-1', serviceName: 'checkout-api', ecosystem: 'npm', updatedAt: NOW, lastScannedAt: NOW, lastScanError: null }])),
  );
  await page.route(api((path) => path.endsWith('/findings/report')), (route) => route.fulfill(json(REPORT)));
  await page.route(api((path) => /\/findings\/f-\d$/.test(path)), (route) =>
    route.fulfill(json({ ...OPEN[0], suspectDeployment: { version: 'v42', commitSha: 'abc1234', deployedAt: NOW, minutesBeforeFinding: 9 } })),
  );
  await page.route(api((path) => path.endsWith('/findings')), (route) => {
    const status = new URL(route.request().url()).searchParams.get('status');
    return route.fulfill(json(status === 'resolved' ? RESOLVED : OPEN));
  });
  await page.route(api((path) => path.endsWith('/status')), (route) => {
    patches.push(route.request().postDataJSON());
    return route.fulfill(json({ ...OPEN[0], status: 'resolved' }));
  });
  return patches;
}

test.describe('findings', () => {
  test('lists open findings from every category and moves between status tabs', async ({ page }) => {
    await mockFindings(page);
    await page.goto(`${PAGE}/findings`);

    await expect(page.getByText('Slow checkout')).toBeVisible();
    await expect(page.getByText('AWS access key found in auth-api logs')).toBeVisible();
    await expect(page.getByText('TypeError in checkout-api')).toBeVisible();

    await page.getByRole('tab', { name: /Resolved/ }).click();
    await expect(page.getByText('Old slow query')).toBeVisible();
    await expect(page.getByText('Slow checkout')).toHaveCount(0);
  });

  test('shows the recommendation and the deploy that preceded it, and resolves the finding', async ({ page }) => {
    const patches = await mockFindings(page);
    await page.goto(`${PAGE}/findings`);
    await page.getByText('Slow checkout').click();

    await expect(page.getByText('Recommended fix')).toBeVisible();
    await expect(page.getByText('Fix the slowest span first.')).toBeVisible();
    await expect(page.getByText('Started after a deploy')).toBeVisible();
    await expect(page.getByText(/v42 went out 9 min before/)).toBeVisible();

    await page.getByRole('button', { name: 'Mark resolved' }).click();
    await expect.poll(() => patches).toEqual([{ status: 'resolved' }]);
  });

  test('shows when dependencies were last scanned', async ({ page }) => {
    await mockFindings(page);
    await page.goto(`${PAGE}/findings`);
    await expect(page.getByText('Scan dependencies for known vulnerabilities')).toBeVisible();
    await expect(page.getByText(/checkout-api: scanned/)).toBeVisible();
  });

  test('summarises open findings by category in the report', async ({ page }) => {
    await mockFindings(page);
    await page.goto(`${PAGE}/report`);

    await expect(page.getByRole('heading', { name: 'Findings report' })).toBeVisible();
    await expect(page.getByText('2 critical')).toBeVisible();
    for (const category of ['Errors', 'Performance', 'Security', 'Vulnerabilities']) {
      await expect(page.getByRole('cell', { name: category })).toBeVisible();
    }
  });
});
