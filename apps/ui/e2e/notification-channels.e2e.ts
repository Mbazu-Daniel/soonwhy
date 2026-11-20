import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mock-api';

const PAGE = '/acme/p/web/alerts';

const EMAIL = { id: 'ch-1', name: 'On-call email', type: 'email', recipientEmails: ['sre@example.com', 'oncall@example.com'], slackChannelId: null, webhookUrl: null, isActive: true };
const SLACK = { id: 'ch-2', name: 'Ops Slack', type: 'slack', recipientEmails: [], slackChannelId: 'C0123456789', webhookUrl: null, isActive: true };
const HOOK = { id: 'ch-3', name: 'Pager hook', type: 'webhook', recipientEmails: [], slackChannelId: null, webhookUrl: 'https://hooks.example.com/alerts', isActive: false };

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

interface Sent { method: string; path: string; body: Record<string, unknown> | null }

async function setup(page: Page, options: { channels?: unknown[]; failList?: boolean; failSave?: string } = {}) {
  const sent: Sent[] = [];
  await mockApi(page);
  const isApi = (url: URL) => url.pathname.startsWith('/api/v1/');
  await page.route((url) => isApi(url) && url.pathname.endsWith('/notifications/channels'), (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return options.failList ? route.fulfill(json({ message: 'boom' }, 500)) : route.fulfill(json(options.channels ?? []));
    }
    sent.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.postDataJSON() });
    return options.failSave ? route.fulfill(json({ message: options.failSave }, 400)) : route.fulfill(json({ ...EMAIL, id: 'ch-new' }));
  });
  await page.route((url) => isApi(url) && /\/notifications\/channels\/[^/]+$/.test(url.pathname), (route) => {
    const request = route.request();
    sent.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.method() === 'DELETE' ? null : request.postDataJSON() });
    return route.fulfill(json({}));
  });
  return sent;
}

async function openChannels(page: Page) {
  await page.goto(PAGE);
  await page.getByRole('tab', { name: 'Channels' }).click();
}

async function chooseType(page: Page, type: string) {
  await page.getByRole('dialog').getByRole('combobox').first().click();
  await page.getByRole('option', { name: type, exact: true }).click();
}

test.describe('notification channels', () => {
  test('explains the empty state', async ({ page }) => {
    await setup(page);
    await openChannels(page);
    await expect(page.getByText('No notification channels')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create channel' })).toBeVisible();
  });

  test('lists each channel with the destination that fits its type', async ({ page }) => {
    await setup(page, { channels: [EMAIL, SLACK, HOOK] });
    await openChannels(page);

    await expect(page.getByText('sre@example.com, oncall@example.com')).toBeVisible();
    await expect(page.getByText('C0123456789')).toBeVisible();
    await expect(page.getByText('https://hooks.example.com/alerts')).toBeVisible();
    await expect(page.getByText('disabled', { exact: true })).toBeVisible();
  });

  test('creates an email channel with a trimmed list of recipients', async ({ page }) => {
    const sent = await setup(page);
    await openChannels(page);
    await page.getByRole('button', { name: 'Create channel' }).click();

    await page.getByLabel('Name').fill('  Team email  ');
    await page.getByLabel('Recipient emails').fill('a@example.com ,  b@example.com ,');
    await page.getByRole('button', { name: 'Create channel' }).last().click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ method: 'POST' });
    expect(sent[0]!.body).toEqual({ name: 'Team email', type: 'email', recipientEmails: ['a@example.com', 'b@example.com'] });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('refuses an address without an @ and sends nothing', async ({ page }) => {
    const sent = await setup(page);
    await openChannels(page);
    await page.getByRole('button', { name: 'Create channel' }).click();

    await page.getByLabel('Name').fill('Bad email');
    await page.getByLabel('Recipient emails').fill('not-an-address');
    await expect(page.getByText('Please enter valid email addresses').first()).toBeVisible();
    await page.getByRole('button', { name: 'Create channel' }).last().click();

    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Please enter valid email addresses');
    expect(sent).toEqual([]);
  });

  test('creates a Slack channel', async ({ page }) => {
    const sent = await setup(page);
    await openChannels(page);
    await page.getByRole('button', { name: 'Create channel' }).click();
    await page.getByLabel('Name').fill('Ops');
    await chooseType(page, 'slack');
    await page.getByLabel('Slack channel ID').fill(' C0999 ');
    await page.getByRole('button', { name: 'Create channel' }).last().click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]!.body).toEqual({ name: 'Ops', type: 'slack', recipientEmails: [], slackChannelId: 'C0999' });
  });

  test('creates a webhook channel with its secret', async ({ page }) => {
    const sent = await setup(page);
    await openChannels(page);
    await page.getByRole('button', { name: 'Create channel' }).click();
    await page.getByLabel('Name').fill('Pager');
    await chooseType(page, 'webhook');
    await page.getByLabel('Webhook URL').fill('https://hooks.example.com/pager');
    await page.getByLabel('Webhook secret').fill('s3cret');
    await page.getByRole('button', { name: 'Create channel' }).last().click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]!.body).toEqual({ name: 'Pager', type: 'webhook', recipientEmails: [], webhookUrl: 'https://hooks.example.com/pager', webhookSecret: 's3cret' });
  });

  test('shows the fields for the type you choose and hides the others', async ({ page }) => {
    await setup(page);
    await openChannels(page);
    await page.getByRole('button', { name: 'Create channel' }).click();

    await expect(page.getByLabel('Recipient emails')).toBeVisible();
    await chooseType(page, 'slack');
    await expect(page.getByLabel('Recipient emails')).toHaveCount(0);
    await expect(page.getByLabel('Slack channel ID')).toBeVisible();
    await chooseType(page, 'webhook');
    await expect(page.getByLabel('Slack channel ID')).toHaveCount(0);
    await expect(page.getByLabel('Webhook URL')).toBeVisible();
  });

  test('edits a webhook, keeping the secret when the field is left blank', async ({ page }) => {
    const sent = await setup(page, { channels: [HOOK] });
    await openChannels(page);
    await page.getByRole('button', { name: 'Edit' }).click();

    await expect(page.getByRole('heading', { name: 'Edit channel' })).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveValue('Pager hook');
    await expect(page.getByLabel('Webhook URL')).toHaveValue('https://hooks.example.com/alerts');
    await expect(page.getByRole('dialog').getByRole('combobox').first()).toBeDisabled();

    await page.getByLabel('Name').fill('Pager hook v2');
    await page.getByRole('button', { name: 'Update channel' }).click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ method: 'PUT', path: expect.stringMatching(/\/channels\/ch-3$/) });
    expect(sent[0]!.body).toMatchObject({ name: 'Pager hook v2', isActive: false, webhookUrl: 'https://hooks.example.com/alerts' });
    expect(sent[0]!.body).not.toHaveProperty('webhookSecret');
    expect(sent[0]!.body).not.toHaveProperty('type');
  });

  test('re-activates a disabled channel from the edit form', async ({ page }) => {
    const sent = await setup(page, { channels: [HOOK] });
    await openChannels(page);
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('dialog').getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'active', exact: true }).click();
    await page.getByRole('button', { name: 'Update channel' }).click();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]!.body).toMatchObject({ isActive: true });
  });

  test('deletes a channel after the confirmation', async ({ page }) => {
    const sent = await setup(page, { channels: [EMAIL] });
    page.once('dialog', (dialog) => void dialog.accept());
    await openChannels(page);
    await page.getByRole('button', { name: 'Delete On-call email' }).click();

    await expect.poll(() => sent.map((item) => item.method)).toEqual(['DELETE']);
  });

  test('keeps the channel when the confirmation is declined', async ({ page }) => {
    const sent = await setup(page, { channels: [EMAIL] });
    page.once('dialog', (dialog) => void dialog.dismiss());
    await openChannels(page);
    await page.getByRole('button', { name: 'Delete On-call email' }).click();
    await page.waitForTimeout(300);

    expect(sent).toEqual([]);
  });

  test('shows the server error and keeps the form open', async ({ page }) => {
    await setup(page, { failSave: 'Channel name already exists' });
    await openChannels(page);
    await page.getByRole('button', { name: 'Create channel' }).click();
    await page.getByLabel('Name').fill('Dup');
    await page.getByLabel('Recipient emails').fill('a@example.com');
    await page.getByRole('button', { name: 'Create channel' }).last().click();

    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Channel name already exists');
  });

  test('shows a retry state when the list fails to load', async ({ page }) => {
    await setup(page, { failList: true });
    await openChannels(page);
    await expect(page.getByRole('alert')).toContainText('Unable to load this view');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
