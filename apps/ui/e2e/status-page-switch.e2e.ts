import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mock-api';

const PAGE = '/acme/p/web/synthetic-probes';

async function mockSettings(page: Page, role: string) {
  const puts: unknown[] = [];
  await mockApi(page);
  await page.route('**/api/v1/**/member-context', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role }) }),
  );
  await page.route('**/api/v1/**/projects/proj-1/settings', async (route) => {
    const request = route.request();
    if (request.method() === 'PUT') {
      puts.push(request.postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusPagePublic: true }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusPagePublic: false }) });
  });
  return puts;
}

test.describe('status page switch', () => {
  test('lets an admin turn the public page on and shows its address', async ({ page }) => {
    const puts = await mockSettings(page, 'admin');
    await page.goto(PAGE);

    const toggle = page.getByRole('switch', { name: 'Public status page' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(puts).toEqual([{ statusPagePublic: true }]);
    await expect(page.getByRole('link', { name: /\/public\/status\/acme\/web$/ })).toBeVisible();
  });

  test('keeps the switch locked for a plain member', async ({ page }) => {
    await mockSettings(page, 'member');
    await page.goto(PAGE);

    await expect(page.getByRole('switch', { name: 'Public status page' })).toBeDisabled();
    await expect(page.getByText('Only an owner or admin can change this.')).toBeVisible();
  });
});
