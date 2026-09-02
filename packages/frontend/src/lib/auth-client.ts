import { createAuthClient } from 'better-auth/react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const authClient = createAuthClient({
  baseURL: API_BASE,
});

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
