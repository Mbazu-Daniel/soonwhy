import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, apiProblem } from './api';

let store: Map<string, string>;
let assign: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

function respond(status: number, body: unknown = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url: new URL(url), headers: init.headers as Record<string, string>, init };
}

beforeEach(() => {
  store = new Map();
  assign = vi.fn();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
  vi.stubGlobal('window', { location: { pathname: '/org/errors', search: '?range=1h', assign } });
});

afterEach(() => vi.unstubAllGlobals());

describe('api request scoping', () => {
  it('puts a project path under the chosen organization', async () => {
    store.set('org_id', 'org 1');
    fetchMock.mockResolvedValue(respond(200, { ok: true }));

    await api.get('/projects');

    expect(lastCall().url.pathname).toBe('/api/v1/organization/org%201/projects');
  });

  it('leaves account-level paths alone', async () => {
    store.set('org_id', 'org_1');
    fetchMock.mockImplementation(() => Promise.resolve(respond(200, {})));

    for (const path of ['/organizations', '/auth/session', '/public/status/a/b', '/admin/dlq']) {
      await api.get(path);
      expect(lastCall().url.pathname).toBe('/api/v1' + path);
    }
  });

  it('does not wrap a path that is already organization-scoped', async () => {
    store.set('org_id', 'org_1');
    fetchMock.mockResolvedValue(respond(200, {}));

    await api.get('/organization/org_2/projects');

    expect(lastCall().url.pathname).toBe('/api/v1/organization/org_2/projects');
  });

  it('refuses to guess an organization when none is chosen', async () => {
    await expect(api.get('/projects')).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the bearer token and organization header when signed in', async () => {
    store.set('org_id', 'org_1');
    store.set('session_token', 'tok');
    fetchMock.mockResolvedValue(respond(200, {}));

    await api.get('/projects');

    expect(lastCall().headers).toMatchObject({ Authorization: 'Bearer tok', 'X-Org-Id': 'org_1' });
  });

  it('sends no credentials when signed out', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));

    await api.get('/organizations');

    expect(lastCall().headers).not.toHaveProperty('Authorization');
    expect(lastCall().headers).not.toHaveProperty('X-Org-Id');
  });
});

describe('api request bodies', () => {
  beforeEach(() => store.set('org_id', 'org_1'));

  it('encodes a JSON body and the method', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));

    await api.put('/projects/p1', { name: 'x' });

    expect(lastCall().init.method).toBe('PUT');
    expect(lastCall().init.body).toBe('{"name":"x"}');
  });

  it('sends no body for a POST without one', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));

    await api.post('/probes/1/run');

    expect(lastCall().init).not.toHaveProperty('body');
  });

  it('returns undefined for a 204', async () => {
    fetchMock.mockResolvedValue(respond(204));

    await expect(api.delete('/projects/p1')).resolves.toBeUndefined();
  });
});

describe('api errors', () => {
  beforeEach(() => store.set('org_id', 'org_1'));

  it('turns a failure into an error that carries the problem details', async () => {
    fetchMock.mockResolvedValue(respond(403, { code: 'forbidden', title: 'Nope', detail: 'Only admins', hint: 'Ask an owner' }));

    const error = await api.get('/projects').catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 403, message: 'Only admins' });
    expect(apiProblem(error)).toEqual({ code: 'forbidden', title: 'Nope', detail: 'Only admins', hint: 'Ask an owner', status: 403 });
  });

  it('falls back to a generic message when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500, statusText: 'Server Error' }));

    await expect(api.get('/projects')).rejects.toMatchObject({ status: 500, message: 'Server Error' });
  });

  it('reads no problem from an error that did not come from the API', () => {
    expect(apiProblem(new Error('x'))).toEqual({});
  });

  it('signs the user out on a 401 and remembers where they were', async () => {
    store.set('session_token', 'tok');
    store.set('org_slug', 'acme');
    fetchMock.mockResolvedValue(respond(401, { message: 'expired' }));

    await expect(api.get('/projects')).rejects.toMatchObject({ status: 401 });

    expect(store.has('session_token')).toBe(false);
    expect(store.has('org_id')).toBe(false);
    expect(store.has('org_slug')).toBe(false);
    expect(store.get('soonwhy:return-path')).toBe('/org/errors?range=1h');
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('does not bounce to the login page again when already on it', async () => {
    vi.stubGlobal('window', { location: { pathname: '/login', search: '', assign } });
    fetchMock.mockResolvedValue(respond(401, {}));

    await expect(api.get('/projects')).rejects.toMatchObject({ status: 401 });

    expect(assign).not.toHaveBeenCalled();
  });
});
