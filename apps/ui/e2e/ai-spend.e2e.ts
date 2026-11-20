import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mock-api';

const PAGE = '/acme/ai';

const USAGE = {
  tokens: { platform: 4_000, byok: 90_000 },
  invocations: 12,
  costUsd: { platform: 0.08, byok: 1.42 },
  projects: [
    { projectId: 'proj-1', name: 'Web', slug: 'web', runs: 10, rcaTokens: 80_000, chatTokens: 10_000, costUsd: 1.2 },
    { projectId: 'proj-2', name: 'Worker', slug: 'worker', runs: 2, rcaTokens: 4_000, chatTokens: 0, costUsd: 0.3 },
  ],
};

const LAST_MONTH = {
  tokens: { platform: 0, byok: 9_000 },
  invocations: 5,
  costUsd: { platform: 0, byok: 2.5 },
  projects: [{ projectId: 'proj-2', name: 'Worker', slug: 'worker', runs: 5, rcaTokens: 9_000, chatTokens: 0, costUsd: 2.5 }],
};

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

interface Options {
  canManage?: boolean;
  usage?: (period: string | null) => { status: number; body: unknown };
}

async function mockAi(page: Page, options: Options = {}) {
  const periods: Array<string | null> = [];
  await mockApi(page);
  await page.route((url) => url.pathname.startsWith('/api/v1/') && url.pathname.endsWith('/ai/credentials'), (route) =>
    route.fulfill(json({ credentials: [], canManage: options.canManage ?? true })),
  );
  await page.route((url) => url.pathname.startsWith('/api/v1/') && url.pathname.endsWith('/ai/usage'), (route) => {
    const period = new URL(route.request().url()).searchParams.get('period');
    periods.push(period);
    const answer = options.usage?.(period) ?? { status: 200, body: period === 'last_month' ? LAST_MONTH : USAGE };
    return route.fulfill(json(answer.body, answer.status));
  });
  return periods;
}

test.describe('AI spend by project', () => {
  test('shows what each project spent, biggest first', async ({ page }) => {
    await mockAi(page);
    await page.goto(PAGE);

    await expect(page.getByRole('heading', { name: 'Spend by project' })).toBeVisible();
    const rows = page.getByRole('row').filter({ has: page.getByRole('link') });
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Web');
    await expect(rows.nth(0)).toContainText('$1.20');
    await expect(rows.nth(0)).toContainText('90k');
    await expect(rows.nth(1)).toContainText('Worker');
    await expect(rows.nth(1)).toContainText('$0.30');
  });

  test('shows each project\'s share of the spend', async ({ page }) => {
    await mockAi(page);
    await page.goto(PAGE);
    await expect(page.getByRole('img', { name: '80 percent of spend' })).toBeVisible();
    await expect(page.getByRole('img', { name: '20 percent of spend' })).toBeVisible();
  });

  test('asks the API for the period you pick and shows that period\'s numbers', async ({ page }) => {
    const periods = await mockAi(page);
    await page.goto(PAGE);
    await expect(page.getByText('$1.20')).toBeVisible();

    await page.getByLabel('Period').selectOption('last_month');

    await expect(page.getByText('$2.50').first()).toBeVisible();
    await expect(page.getByText('$1.20')).toHaveCount(0);
    expect(periods).toContain('last_month');
  });

  test('moves the summary cards to the same period as the table', async ({ page }) => {
    await mockAi(page);
    await page.goto(PAGE);
    await expect(page.getByText('Spent this month')).toBeVisible();
    await expect(page.getByText('$1.50', { exact: true })).toBeVisible();
    await expect(page.getByText('RCA runs this month')).toBeVisible();

    await page.getByLabel('Period').selectOption('last_month');

    await expect(page.getByText('Spent last month')).toBeVisible();
    await expect(page.getByText('Tokens last month')).toBeVisible();
    await expect(page.getByText('RCA runs last month')).toBeVisible();
    await expect(page.getByText('$2.50', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('9k', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Spent this month')).toHaveCount(0);
  });

  test('names the period when nothing was spent in it', async ({ page }) => {
    await mockAi(page, { usage: () => ({ status: 200, body: { ...USAGE, projects: [] } }) });
    await page.goto(PAGE);
    await expect(page.getByText('No project used AI this month.')).toBeVisible();
    await page.getByLabel('Period').selectOption('last_30_days');
    await expect(page.getByText('No project used AI in the last 30 days.')).toBeVisible();
  });

  test('still loads when the API sends no project list', async ({ page }) => {
    const { projects: _projects, ...withoutProjects } = USAGE;
    await mockAi(page, { usage: () => ({ status: 200, body: withoutProjects }) });
    await page.goto(PAGE);
    await expect(page.getByText('No project used AI this month.')).toBeVisible();
  });

  test('offers a retry when the spend request fails', async ({ page }) => {
    let fail = true;
    await mockAi(page, {
      usage: () => (fail ? { status: 500, body: { message: 'boom' } } : { status: 200, body: USAGE }),
    });
    await page.goto(PAGE);
    await expect(page.getByText('Could not load AI usage.')).toBeVisible();

    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('$1.20')).toBeVisible();
  });

  test('hides the whole usage section from a member, who may not read usage', async ({ page }) => {
    const periods = await mockAi(page, { canManage: false });
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { name: 'AI Providers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Spend by project' })).toHaveCount(0);
    await expect(page.getByText(/^Spent /)).toHaveCount(0);
    expect(periods).toEqual([]);
  });

  test('explains that cost is an estimate from list prices', async ({ page }) => {
    await mockAi(page);
    await page.goto(PAGE);
    await expect(page.getByText(/Estimated from list prices for analysis runs and investigation chat/)).toBeVisible();
  });
});
