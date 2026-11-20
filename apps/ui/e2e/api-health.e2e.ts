import { expect as baseExpect, test } from '@playwright/test';
import { mockApi } from './mock-api';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 90_000 });

const PAGE = '/acme/p/web/intelligence/api';
const trend = (status: string, p95ChangePct: number | null, errorRateChange: number | null) => ({ status, p95ChangePct, errorRateChange, countChangePct: null });

const HEALTH = {
  from: '2026-11-19T00:00:00.000Z', to: '2026-11-20T00:00:00.000Z', score: 71, grade: 'C',
  endpoints: [
    { url: '/reports/:id', method: 'GET', count: 40, p50: 900, p95: 2400, p99: 4000, errorRate: 6, score: 22, grade: 'F', trend: trend('regressing', 100, 4) },
    { url: '/health', method: 'GET', count: 900, p50: 5, p95: 12, p99: 20, errorRate: 0, score: 100, grade: 'A', trend: trend('new', null, null) },
  ],
};

test.describe('API health', () => {
  test('shows the project score and each endpoint with its trend', async ({ page }) => {
    await mockApi(page);
    await page.route((url) => url.pathname.startsWith('/api/v1/') && url.pathname.endsWith('/requests/endpoints'), (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HEALTH) }),
    );
    await page.goto(PAGE);

    await expect(page.getByLabel('API score')).toHaveText('C · 71');
    await expect(page.getByRole('row', { name: /\/reports\/:id/ })).toContainText('F · 22');
    await expect(page.getByRole('row', { name: /\/reports\/:id/ })).toContainText('Regressing');
    await expect(page.getByRole('row', { name: /\/reports\/:id/ })).toContainText('+100% p95');
    await expect(page.getByRole('row', { name: /\/health/ })).toContainText('Not enough history');
    const rows = await page.getByRole('row').allTextContents();
    expect(rows[1]).toContain('/reports/:id');
  });

  test('says so when there is no traffic', async ({ page }) => {
    await mockApi(page);
    await page.route((url) => url.pathname.startsWith('/api/v1/') && url.pathname.endsWith('/requests/endpoints'), (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...HEALTH, score: null, grade: null, endpoints: [] }) }),
    );
    await page.goto(PAGE);
    await expect(page.getByText('No requests in the last 24 hours.')).toBeVisible();
  });
});
