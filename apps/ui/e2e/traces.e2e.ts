import { expect, test, type Page } from '@playwright/test';
import { mockApi, TRACE } from './mock-api';

const PROJECT_PATH = '/acme/p/web';
const NOW = Date.now();

const SPANS = [
  { spanId: 'root', name: 'GET /orders', service: 'api', duration: 300, timestamp: new Date(NOW - 60_000).toISOString(), status: 'ok', kind: 'server' },
  { spanId: 'db', parentSpanId: 'root', name: 'SELECT orders', service: 'postgres', duration: 80, timestamp: new Date(NOW - 59_950).toISOString(), status: 'ok', kind: 'client' },
  {
    spanId: 'pay',
    parentSpanId: 'root',
    name: 'POST /payments',
    service: 'payments',
    duration: 120,
    timestamp: new Date(NOW - 59_850).toISOString(),
    status: 'error',
    kind: 'client',
    exceptionType: 'TimeoutError',
    exceptionMessage: 'payment gateway slow',
  },
];

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mockTrace(page: Page, spans: unknown[] = SPANS) {
  await mockApi(page);
  await page.route((url) => url.pathname.endsWith('/traces/abc123'), (route) => route.fulfill(json({ traceId: 'abc123', spans })));
}

test.describe('traces list', () => {
  test('lists traces with their operation and service', async ({ page }) => {
    await mockApi(page);
    await page.route((url) => url.pathname.startsWith('/api/v1/') && url.pathname.endsWith('/traces'), (route) =>
      route.fulfill(json({ data: [TRACE, { ...TRACE, traceId: 'def456', name: 'POST /login', rootOperation: 'POST /login', errorCount: 2, status: 'error' }] })),
    );
    await page.goto(`${PROJECT_PATH}/traces`);
    await expect(page.getByText('GET /users').first()).toBeVisible();
    await expect(page.getByText('POST /login').first()).toBeVisible();
  });

  test('keeps a search box so a trace can be found by id or name', async ({ page }) => {
    await mockApi(page);
    await page.goto(`${PROJECT_PATH}/traces`);
    await expect(page.getByLabel('Search traces')).toBeVisible();
  });

  test('sends the search text to the API', async ({ page }) => {
    await mockApi(page);
    const queries: string[] = [];
    await page.route((url) => url.pathname.startsWith('/api/v1/') && url.pathname.endsWith('/traces'), (route) => {
      queries.push(new URL(route.request().url()).search);
      return route.fulfill(json({ data: [TRACE] }));
    });
    await page.goto(`${PROJECT_PATH}/traces`);
    await page.getByLabel('Search traces').fill('checkout');
    await expect.poll(() => queries.some((query) => query.includes('checkout'))).toBe(true);
  });

  test('shows an empty list without crashing', async ({ page }) => {
    await mockApi(page);
    await page.route((url) => url.pathname.startsWith('/api/v1/') && url.pathname.endsWith('/traces'), (route) => route.fulfill(json({ data: [] })));
    await page.goto(`${PROJECT_PATH}/traces`);
    await expect(page.getByLabel('Search traces')).toBeVisible();
    await expect(page.getByText('GET /users')).toHaveCount(0);
  });
});

test.describe('trace detail', () => {
  test('summarises the trace', async ({ page }) => {
    await mockTrace(page);
    await page.goto(`${PROJECT_PATH}/trace/abc123`);
    await expect(page.getByRole('heading', { level: 1, name: 'abc123' })).toBeVisible();
    await expect(page.getByText('Spans', { exact: true })).toBeVisible();
    await expect(page.getByText('Waterfall', { exact: true })).toBeVisible();
  });

  test('draws every span in the waterfall', async ({ page }) => {
    await mockTrace(page);
    await page.goto(`${PROJECT_PATH}/trace/abc123`);
    for (const name of ['GET /orders', 'SELECT orders', 'POST /payments']) {
      await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    }
  });

  test('shows details for the span you click', async ({ page }) => {
    await mockTrace(page);
    await page.goto(`${PROJECT_PATH}/trace/abc123`);
    await page.getByRole('button', { name: /POST \/payments/ }).click();
    await expect(page.getByText('payment gateway slow')).toBeVisible();
  });

  test('says so when the trace does not exist', async ({ page }) => {
    await mockTrace(page, []);
    await page.goto(`${PROJECT_PATH}/trace/abc123`);
    await expect(page.getByText('Trace not found')).toBeVisible();
  });

  test('shows a retry state when the request fails', async ({ page }) => {
    await mockApi(page);
    await page.route((url) => url.pathname.endsWith('/traces/abc123'), (route) => route.fulfill(json({ message: 'boom' }, 500)));
    await page.goto(`${PROJECT_PATH}/trace/abc123`);
    await expect(page.getByRole('alert')).toContainText('Unable to load this view');
  });
});
