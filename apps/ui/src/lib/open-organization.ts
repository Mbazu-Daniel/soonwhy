import { api } from '~/lib/api';

interface Organization { id: string; slug: string; }

export async function firstOrganization() {
  const organizations = await api.get<Organization[]>('/organizations');
  return organizations[0] ?? null;
}
