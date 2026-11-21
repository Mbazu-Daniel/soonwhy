import { expect as baseExpect, test, type Page } from '@playwright/test';
import { mockApi } from './mock-api';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 90_000 });

const PAGE = '/acme/p/web/alerts';

const RULE = {
  id: 'rule-1',
  orgId: 'org-1',
  projectId: 'proj-1',
  name: 'High error rate',
  description: 'Errors above 5 percent',
  conditions: [{ type: 'threshold', metric: 'http.server.request.errors.rate', operator: 'gt', value: 5, window: '15m', aggregation: 'max' }],
  minSeverity: 'high',
  channelIds: ['ch-1'],
  status: 'active',
  dedupeWindowSeconds: 600,
  createdAt: '2026-11-01T00:00:00Z',
};

const CHANNELS = [
  { id: 'ch-1', name: 'On-call email', type: 'email', recipientEmails: ['sre@example.com'], slackChannelId: null, webhookUrl: null, isActive: true },
  { id: 'ch-2', name: 'Ops Slack', type: 'slack', recipientEmails: [], slackChannelId: 'C0123', webhookUrl: null, isActive: true },
];

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

interface Sent { method: string; path: string; body: Record<string, unknown> }

async function setup(page: Page, options: { rules?: unknown[]; channels?: unknown[]; failWith?: { status: number; message: string } } = {}) {
  const sent: Sent[] = [];
  await mockApi(page);
  const isApi = (url: URL, suffix: string) => url.pathname.startsWith('/api/v1/') && url.pathname.endsWith(suffix);
  await page.route((url) => isApi(url, '/notifications/channels'), (route) => route.fulfill(json(options.channels ?? CHANNELS)));
  await page.route((url) => isApi(url, '/notifications/alert-rules'), (route) => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill(json(options.rules ?? []));
    sent.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.postDataJSON() });
    if (options.failWith) return route.fulfill(json({ message: options.failWith.message }, options.failWith.status));
    return route.fulfill(json({ ...RULE, id: 'rule-new' }));
  });
  await page.route((url) => /\/notifications\/alert-rules\/[^/]+$/.test(url.pathname), (route) => {
    const request = route.request();
    sent.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.postDataJSON() });
    if (options.failWith) return route.fulfill(json({ message: options.failWith.message }, options.failWith.status));
    return route.fulfill(json(RULE));
  });
  return sent;
}

async function pick(page: Page, combobox: number, option: string) {
  await page.getByRole('dialog').getByRole('combobox').nth(combobox).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test.describe('alert rule form', () => {
  test('cannot be submitted without a name', async ({ page }) => {
    await setup(page);
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Create alert rule' }).click();

    await expect(page.getByRole('button', { name: 'Create rule' })).toBeDisabled();
    await page.getByLabel('Name').fill('Checkout latency');
    await expect(page.getByRole('button', { name: 'Create rule' })).toBeEnabled();
  });

  test('creates a rule with the values you entered', async ({ page }) => {
    const sent = await setup(page);
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Create alert rule' }).click();

    await page.getByLabel('Name').fill('  Checkout latency  ');
    await page.getByLabel('Description').fill('Too slow');
    await page.getByLabel('Threshold').fill('2500');
    await page.getByLabel('Dedupe window (seconds)').fill('900');
    await pick(page, 0, 'critical');
    await pick(page, 2, 'HTTP error rate (%)');
    await pick(page, 3, '≥');
    await pick(page, 4, '1h');
    await pick(page, 5, 'max');
    await page.getByRole('button', { name: 'Create rule' }).click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ method: 'POST' });
    expect(sent[0]!.body).toEqual({
      name: 'Checkout latency',
      description: 'Too slow',
      minSeverity: 'critical',
      channelIds: [],
      dedupeWindowSeconds: 900,
      findingCategory: null,
      conditions: [{ type: 'threshold', metric: 'http.server.request.errors.rate', operator: 'gte', value: 2500, window: '1h', aggregation: 'max' }],
    });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('files the rule\'s findings under the category you pick, or lets the metric decide', async ({ page }) => {
    const sent = await setup(page);
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Create alert rule' }).click();
    await page.getByLabel('Name').fill('Login failures');
    await expect(page.getByRole('dialog').getByRole('combobox').last()).toContainText('Choose from the metric');

    await page.getByRole('dialog').getByRole('combobox').last().click();
    await page.getByRole('option', { name: 'Security', exact: true }).click();
    await page.getByRole('button', { name: 'Create rule' }).click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]!.body).toMatchObject({ name: 'Login failures', findingCategory: 'security' });
  });

  test('shows the category an existing rule is filed under', async ({ page }) => {
    await setup(page, { rules: [{ ...RULE, findingCategory: 'error' }] });
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Edit High error rate' }).click();
    await expect(page.getByRole('dialog').getByRole('combobox').last()).toContainText('Errors');
  });

  test('uses the defaults when you only give it a name', async ({ page }) => {
    const sent = await setup(page);
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Create alert rule' }).click();
    await page.getByLabel('Name').fill('Defaults');
    await page.getByRole('button', { name: 'Create rule' }).click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]!.body).toMatchObject({
      name: 'Defaults',
      minSeverity: 'medium',
      dedupeWindowSeconds: 300,
      conditions: [{ metric: 'http.server.request.duration.p95', operator: 'gt', value: 1000, window: '5m', aggregation: 'avg' }],
    });
  });

  test('attaches and detaches notification channels', async ({ page }) => {
    const sent = await setup(page);
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Create alert rule' }).click();
    await page.getByLabel('Name').fill('With channels');

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'On-call email' }).click();
    await dialog.getByRole('button', { name: 'Ops Slack' }).click();
    await dialog.getByRole('button', { name: 'On-call email' }).click();
    await dialog.getByRole('button', { name: 'Create rule' }).click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]!.body.channelIds).toEqual(['ch-2']);
  });

  test('points at the Channels tab when there are none', async ({ page }) => {
    await setup(page, { channels: [] });
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Create alert rule' }).click();
    await expect(page.getByText('No channels yet. Create one in the Channels tab')).toBeVisible();
  });

  test('adds and removes conditions', async ({ page }) => {
    const sent = await setup(page);
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Create alert rule' }).click();
    await page.getByLabel('Name').fill('Two conditions');

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Threshold')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Add condition' }).click();
    await expect(dialog.getByLabel('Threshold')).toHaveCount(2);
    await dialog.getByLabel('Threshold').nth(1).fill('50');
    await dialog.getByRole('button', { name: 'Create rule' }).click();

    await expect.poll(() => sent.length).toBe(1);
    expect((sent[0]!.body.conditions as unknown[]).length).toBe(2);
    expect((sent[0]!.body.conditions as Array<{ value: number }>)[1]!.value).toBe(50);
  });

  test('removes a condition with its trash button', async ({ page }) => {
    await setup(page);
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Create alert rule' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Add condition' }).click();
    await expect(dialog.getByLabel('Threshold')).toHaveCount(2);

    await dialog.locator('button.self-end').first().click();
    await expect(dialog.getByLabel('Threshold')).toHaveCount(1);
  });

  test('fills the form from an existing rule and saves changes with PUT', async ({ page }) => {
    const sent = await setup(page, { rules: [RULE] });
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Edit High error rate' }).click();

    await expect(page.getByRole('heading', { name: 'Edit alert rule' })).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveValue('High error rate');
    await expect(page.getByLabel('Threshold')).toHaveValue('5');
    await expect(page.getByLabel('Dedupe window (seconds)')).toHaveValue('600');

    await page.getByLabel('Name').fill('Higher error rate');
    await page.getByLabel('Threshold').fill('8');
    await page.getByRole('button', { name: 'Update rule' }).click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ method: 'PUT', path: expect.stringMatching(/\/alert-rules\/rule-1$/) });
    expect(sent[0]!.body).toMatchObject({
      name: 'Higher error rate',
      status: 'active',
      minSeverity: 'high',
      channelIds: ['ch-1'],
      dedupeWindowSeconds: 600,
      conditions: [{ metric: 'http.server.request.errors.rate', value: 8, window: '15m', aggregation: 'max' }],
    });
  });

  test('starts blank again after editing', async ({ page }) => {
    await setup(page, { rules: [RULE] });
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Edit High error rate' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Create alert rule' }).click();
    await expect(page.getByLabel('Name')).toHaveValue('');
  });

  test('shows the server error and keeps the form open', async ({ page }) => {
    await setup(page, { failWith: { status: 400, message: 'Name already in use' } });
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Create alert rule' }).click();
    await page.getByLabel('Name').fill('Duplicate');
    await page.getByRole('button', { name: 'Create rule' }).click();

    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Name already in use');
    await expect(page.getByLabel('Name')).toHaveValue('Duplicate');
  });

  test('sends nothing when you cancel', async ({ page }) => {
    const sent = await setup(page);
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Create alert rule' }).click();
    await page.getByLabel('Name').fill('Never saved');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(sent).toEqual([]);
  });
});
