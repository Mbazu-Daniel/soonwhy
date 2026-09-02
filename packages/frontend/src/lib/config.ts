export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const API_PREFIX = '/api/v1';

export function getProjectId(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('project_id') : null;
}

export function getOrgId(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('org_id') : null;
}
