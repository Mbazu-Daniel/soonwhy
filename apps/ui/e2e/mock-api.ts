import type { Page } from '@playwright/test';

export const ORG = { id: 'org-1', name: 'Acme', slug: 'acme' };
export const PROJECT = { id: 'proj-1', name: 'Web', slug: 'web' };

const NOW = Date.now();
const FIVE_MIN = 5 * 60 * 1000;

export const SAMPLE_BUCKETS = Array.from({ length: 12 }, (_, index) => ({
  bucket: new Date(NOW - (12 - index) * FIVE_MIN).toISOString(),
  count: 10 + index * 5,
  p50: 12,
  p95: 40,
  p99: 90,
  _2xx: 9 + index * 5,
  _3xx: 0,
  _4xx: 1,
  _5xx: 0,
}));

export const SUMMARY = {
  totalRequests: 1234,
  errorRate: 1.5,
  latencyP50: 12,
  latencyP95: 40,
  latencyP99: 90,
  statusCodes: { _2xx: 1200, _3xx: 4, _4xx: 20, _5xx: 10 },
};

export const LOG_FIELDS = [
  { name: 'level', kind: 'core', count: 0 },
  { name: 'service', kind: 'core', count: 0 },
  { name: 'traceId', kind: 'core', count: 0 },
  { name: 'attributes.traceId', kind: 'attribute', count: 24 },
  { name: 'attributes.http.route', kind: 'attribute', count: 24 },
];

export const LOG_BUCKETS = Array.from({ length: 10 }, (_, index) => ({
  key: NOW - (10 - index) * FIVE_MIN,
  doc_count: index === 4 ? 0 : 3 + index,
}));

export const TRACE = {
  traceId: 'abc123',
  name: 'GET /users',
  rootService: 'api',
  rootOperation: 'GET /users',
  start: new Date(NOW - 60_000).toISOString(),
  end: new Date(NOW - 59_994).toISOString(),
  startTime: new Date(NOW - 60_000).toISOString(),
  durationMs: 5.600341796875,
  spanCount: 2,
  errorCount: 0,
  status: 'ok',
};

export const ERROR_GROUP = {
  fingerprint: 'fp1',
  service: 'api',
  errorType: 'TypeError',
  errorMessage: 'x is undefined',
  level: 'error',
  count: 7,
  traceCount: 3,
  firstSeen: new Date(NOW - 3_600_000).toISOString(),
  lastSeen: new Date(NOW - 60_000).toISOString(),
  traceId: 'abc123',
  spanId: 'span1',
  logId: 'log1',
  exception: 'TypeError: x is undefined',
  environments: ['production'],
  issue: { status: 'unresolved', resolvedAt: null },
};

export interface MockOptions {
  buckets?: typeof SAMPLE_BUCKETS;
}

function body(pathname: string, options: MockOptions): unknown {
  if (pathname === '/auth/session') return { user: { id: 'user-1', email: 'a@b.test' } };
  if (pathname === '/organizations') return [ORG];
  if (pathname.endsWith('/projects')) return [PROJECT];
  if (pathname.endsWith('/services')) return [];
  if (pathname.endsWith('/metrics/summary')) return SUMMARY;
  if (pathname.endsWith('/metrics/host')) return { buckets: [] };
  if (pathname.endsWith('/metrics')) return { buckets: options.buckets ?? SAMPLE_BUCKETS };
  if (pathname.endsWith('/logs/histogram')) return { timeline: { buckets: LOG_BUCKETS }, total: 40 };
  if (pathname.endsWith('/logs/fields/values')) return { data: [{ value: 'info', count: 30 }, { value: 'error', count: 10 }] };
  if (pathname.endsWith('/logs/fields')) return { data: LOG_FIELDS };
  if (pathname.endsWith('/logs')) return { data: [], total: 40 };
  if (pathname.endsWith('/traces/stats')) return { interval: '5m', buckets: [] };
  if (pathname.endsWith('/traces')) return { data: [TRACE] };
  if (pathname.endsWith('/dashboard/errors')) return [ERROR_GROUP];
  return [];
}

export async function mockApi(page: Page, options: MockOptions = {}): Promise<void> {
  await page.addInitScript(({ org, project }) => {
    localStorage.setItem('session_token', 'e2e-token');
    localStorage.setItem('org_id', org.id);
    localStorage.setItem('org_slug', org.slug);
    localStorage.setItem('project_id', project.id);
    localStorage.setItem('project_slug', project.slug);
  }, { org: ORG, project: PROJECT });

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace(/^\/api\/v1/, '').replace(/^\/organization\/[^/]+/, '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body(pathname, options)) });
  });
}
