import { API_BASE, API_PREFIX } from './config';

export interface User {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
  emailVerified: boolean;
}

export interface Session {
  user: User;
  session: { id: string; token: string; expiresAt: string };
}

export interface AuthResult {
  data?: { session: { token: string; id: string; expiresAt: string }; user: User };
  error?: { message: string; status: number };
}

export interface AuthProviders {
  emailAndPassword: boolean;
  google: boolean;
  github: boolean;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}${API_PREFIX}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.message || 'Sign in failed', status: res.status } };
    return { data };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Sign in failed', status: 0 } };
  }
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}${API_PREFIX}/auth/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.message || 'Sign up failed', status: res.status } };
    return { data };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Sign up failed', status: 0 } };
  }
}

export async function getAuthProviders(): Promise<AuthProviders> {
  const fallback: AuthProviders = { emailAndPassword: true, google: false, github: false };

  try {
    const res = await fetch(`${API_BASE}${API_PREFIX}/auth/providers`, {
      credentials: 'include',
    });
    if (!res.ok) return fallback;
    return { ...fallback, ...(await res.json()) };
  } catch {
    return fallback;
  }
}

export function getSocialSignInUrl(provider: 'google' | 'github', callbackPath = '/auth/callback'): string {
  const callbackURL = typeof window !== 'undefined'
    ? new URL(callbackPath, window.location.origin).toString()
    : callbackPath;

  return `${API_BASE}${API_PREFIX}/auth/social/${provider}?callbackURL=${encodeURIComponent(callbackURL)}`;
}

export async function signOut(token?: string): Promise<void> {
  try {
    await fetch(`${API_BASE}${API_PREFIX}/auth/sign-out`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    // Sign out is best-effort — clear local state regardless
  }
}

export async function getSession(token?: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}${API_PREFIX}/auth/session`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.message || 'Session expired', status: res.status } };
    return { data };
  } catch {
    return { error: { message: 'Network error', status: 0 } };
  }
}

export function setSessionToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('session_token', token);
  }
}

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('session_token');
}

export function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('session_token');
    localStorage.removeItem('org_id');
    localStorage.removeItem('project_id');
  }
}
