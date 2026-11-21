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

async function mockTrace(page: Page, spans: unknown[] = SPANS, analysis: Record<string, unknown> = {}) {
  await mockApi(page);
  await page.route((url) => url.pathname.endsWith('/traces/abc123'), (route) => route.fulfill(json({ traceId: 'abc123', spans, ...analysis })));
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

  test('lists the request\'s database queries with index hints', async ({ page }) => {
    await mockTrace(page, SPANS, {
      queries: {
      queryCount: 9, totalQueryMs: 80, traceMs: 300,
      queries: [{
        query: 'SELECT * FROM order_items WHERE order_id = ?', operation: 'SELECT', table: 'order_items', filterColumns: ['order_id'],
        count: 8, totalMs: 60, maxMs: 9, avgMs: 7.5, shareOfTrace: 0.2, spanId: 'db',
        hints: [{ kind: 'repeated', message: 'Runs 8 times in this request. Load the rows in one query with a join or an IN list.' }, { kind: 'index', message: 'Filters order_items by order_id. Check that an index covers this column, and run EXPLAIN on it.' }],
      }],
      },
    });
    await page.goto(`${PROJECT_PATH}/trace/abc123`);
    await expect(page.getByText('Database queries')).toBeVisible();
    await expect(page.getByText('SELECT * FROM order_items WHERE order_id = ?')).toBeVisible();
    await expect(page.getByText('Runs 8 times in this request')).toBeVisible();
    await expect(page.getByText('Check that an index covers this column')).toBeVisible();
  });

  test('shows what is wrong with a request and response body', async ({ page }) => {
    await mockTrace(page, SPANS, {
      payloads: [
      { spanId: 'root', operation: 'GET /orders', side: 'response', bytes: 250000, format: 'json', fieldCount: 12, issues: [
        { kind: 'large', side: 'response', message: 'The response body is 250 KB. Send less data or compress it.' },
        { kind: 'sensitive_field', side: 'response', path: 'user.token', message: 'The response carries "user.token", which looks sensitive. Do not return it to the client.' },
      ] },
      ],
    });
    await page.goto(`${PROJECT_PATH}/trace/abc123`);
    await expect(page.getByText('Request and response bodies')).toBeVisible();
    await expect(page.getByText('250.0 KB · 12 fields')).toBeVisible();
    await expect(page.getByText('Send less data or compress it')).toBeVisible();
    await expect(page.getByText('Do not return it to the client')).toBeVisible();
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
