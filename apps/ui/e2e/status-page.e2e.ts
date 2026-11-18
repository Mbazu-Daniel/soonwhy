import { expect, test } from '@playwright/test';

const PAGE = '/public/status/acme/web';
const PROBE_URL = 'https://internal.example/health?token=secret';

const STATUS = {
  overallStatus: 'up',
  lastUpdated: new Date().toISOString(),
  services: [
    { name: 'Checkout API', status: 'up', uptimePercent: 100, totalChecks: 50, failedChecks: 0, lastCheckAt: null, incidents: [] },
  ],
};

test.describe('public status page', () => {
  test('shows each service and its uptime without the address being checked', async ({ page }) => {
    await page.route('**/api/v1/public/status/acme/web', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATUS) }),
    );

    await page.goto(PAGE);

    await expect(page.getByText('All Systems Operational')).toBeVisible();
    await expect(page.getByText('Checkout API')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(PROBE_URL);
    await expect(page.locator('body')).not.toContainText('internal.example');
  });

  test('does not show a page for a project that has not turned it on', async ({ page }) => {
    await page.route('**/api/v1/public/status/acme/web', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Project not found' }) }),
    );

    await page.goto(PAGE);

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('All Systems Operational')).toHaveCount(0);
  });
});
