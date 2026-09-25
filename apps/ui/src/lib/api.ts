import { API_BASE, API_PREFIX } from './config';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const UNSCOPED_PREFIXES = ['/auth', '/organizations', '/health', '/marketing'];

function scopePath(path: string, orgId: string | null): string {
  const pathname = path.split('?')[0] ?? path;
  const unscoped = UNSCOPED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (unscoped || pathname.startsWith('/organization/')) return path;
  if (!orgId) throw new ApiError(400, 'Choose an organization first');
  return `/organization/${encodeURIComponent(orgId)}${path.startsWith('/') ? path : `/${path}`}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org_id') : null;
  const url = `${API_BASE}${API_PREFIX}${scopePath(path, orgId)}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (orgId) {
    headers['X-Org-Id'] = orgId;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));

    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('session_token');
      localStorage.removeItem('org_id');
      localStorage.removeItem('org_slug');
      localStorage.removeItem('project_id');
      localStorage.setItem('soonwhy:return-path', window.location.pathname + window.location.search);
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/register') window.location.assign('/login');
    }

    throw new ApiError(res.status, body.message || body.detail || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
