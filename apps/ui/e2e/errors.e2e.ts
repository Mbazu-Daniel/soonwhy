import { expect, test, type Page } from '@playwright/test';
import { ERROR_GROUP, mockApi } from './mock-api';

const PROJECT_PATH = '/acme/p/web';
const NOW = Date.now();

const GROUPS = [
  { ...ERROR_GROUP, fingerprint: 'fp-open', errorMessage: 'cart is undefined', issue: { status: 'unresolved', resolvedAt: null } },
  { ...ERROR_GROUP, fingerprint: 'fp-done', errorMessage: 'card declined', issue: { status: 'resolved', resolvedAt: new Date(NOW).toISOString() } },
  { ...ERROR_GROUP, fingerprint: 'fp-quiet', errorMessage: 'favicon missing', issue: { status: 'ignored', resolvedAt: null } },
];

const DETAIL = {
  ...ERROR_GROUP,
  fingerprint: 'fp-open',
  errorMessage: 'cart is undefined',
  traceException: null,
  findingId: null,
  traceIds: ['abc123'],
  timeline: [{ start: new Date(NOW - 3_600_000).toISOString(), count: 7 }],
  occurrences: [
    {
      id: 'occ-1',
      timestamp: new Date(NOW - 60_000).toISOString(),
      level: 'error',
      message: 'cart is undefined',
      traceId: 'abc123',
      spanId: 'span1',
      stackTrace: 'TypeError: cart is undefined\n    at placeOrder (/app/src/orders.ts:42:7)\n    at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)',
      attributes: {},
    },
  ],
};

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mockErrorList(page: Page, groups: unknown) {
  await mockApi(page);
  await page.route((url) => url.pathname.endsWith('/dashboard/errors'), (route) => route.fulfill(json(groups)));
}

test.describe('errors list', () => {
  test('shows only open issues first, then each status on its tab', async ({ page }) => {
    await mockErrorList(page, GROUPS);
    await page.goto(`${PROJECT_PATH}/errors`);

    await expect(page.getByText('cart is undefined')).toBeVisible();
    await expect(page.getByText('card declined')).toHaveCount(0);
    await expect(page.getByText('favicon missing')).toHaveCount(0);

    await page.getByRole('tab', { name: /Resolved/ }).click();
    await expect(page.getByText('card declined')).toBeVisible();
    await expect(page.getByText('cart is undefined')).toHaveCount(0);

    await page.getByRole('tab', { name: /Ignored/ }).click();
    await expect(page.getByText('favicon missing')).toBeVisible();

    await page.getByRole('tab', { name: /All/ }).click();
    await expect(page.getByRole('article')).toHaveCount(3);
  });

  test('puts a count on every tab', async ({ page }) => {
    await mockErrorList(page, GROUPS);
    await page.goto(`${PROJECT_PATH}/errors`);
    await expect(page.getByRole('tab', { name: 'Open 1' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'All 3' })).toBeVisible();
  });

  test('says there are no errors when the range is empty', async ({ page }) => {
    await mockErrorList(page, []);
    await page.goto(`${PROJECT_PATH}/errors`);
    await expect(page.getByText('No errors found')).toBeVisible();
  });

  test('points at another tab when the open view is empty', async ({ page }) => {
    await mockErrorList(page, [GROUPS[1]]);
    await page.goto(`${PROJECT_PATH}/errors`);
    await expect(page.getByText('Nothing in this view')).toBeVisible();
  });

  test('shows a retry state when the request fails', async ({ page }) => {
    await mockApi(page);
    await page.route((url) => url.pathname.endsWith('/dashboard/errors'), (route) => route.fulfill(json({ message: 'boom' }, 500)));
    await page.goto(`${PROJECT_PATH}/errors`);
    await expect(page.getByRole('alert')).toContainText('Unable to load this view');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('creates a finding from a group', async ({ page }) => {
    await mockErrorList(page, [GROUPS[0]]);
    const posts: string[] = [];
    await page.route((url) => url.pathname.endsWith('/errors/fp-open/finding'), (route) => {
      posts.push(route.request().method());
      return route.fulfill(json({ status: 'created' }));
    });
    await page.goto(`${PROJECT_PATH}/errors`);

    await page.getByRole('button', { name: 'Create finding' }).click();
    await expect(page.getByText('Finding created.')).toBeVisible();
    expect(posts).toEqual(['POST']);
  });
});

test.describe('error detail', () => {
  async function openDetail(page: Page) {
    await mockApi(page);
    await page.route((url) => url.pathname.endsWith('/dashboard/errors/fp-open'), (route) => route.fulfill(json(DETAIL)));
    await page.route((url) => url.pathname.endsWith('/logs'), (route) =>
      route.fulfill(json({ data: [{ id: 'l1', timestamp: new Date(NOW).toISOString(), level: 'error', message: 'checkout failed for cart 9' }], total: 1 })),
    );
    await page.goto(`${PROJECT_PATH}/errors/fp-open`);
  }

  test('shows the message, the app frame and the trace logs', async ({ page }) => {
    await openDetail(page);
    await expect(page.getByRole('heading', { level: 1, name: 'cart is undefined' })).toBeVisible();
    await expect(page.getByText('placeOrder')).toBeVisible();
    await expect(page.getByText('Layer.handle')).toHaveCount(0);
    await expect(page.getByText('checkout failed for cart 9')).toBeVisible();
  });

  test('reveals library frames on request', async ({ page }) => {
    await openDetail(page);
    await page.getByRole('button', { name: 'Show all frames' }).click();
    await expect(page.getByText('Layer.handle')).toBeVisible();
  });

  test('changes the status and sends it to the API', async ({ page }) => {
    await openDetail(page);
    const bodies: unknown[] = [];
    await page.route((url) => url.pathname.endsWith('/errors/fp-open/status'), (route) => {
      bodies.push(route.request().postDataJSON());
      return route.fulfill(json({ status: 'resolved', resolvedAt: new Date(NOW).toISOString() }));
    });

    await page.getByRole('button', { name: 'Resolve' }).click();
    await expect.poll(() => bodies).toEqual([{ status: 'resolved' }]);
  });

  test('says so when the group has no occurrences in the range', async ({ page }) => {
    await mockApi(page);
    await page.route((url) => url.pathname.endsWith('/dashboard/errors/fp-open'), (route) => route.fulfill(json({ message: 'not found' }, 404)));
    await page.goto(`${PROJECT_PATH}/errors/fp-open`);
    await expect(page.getByText('No occurrences in this time range')).toBeVisible();
  });
});
