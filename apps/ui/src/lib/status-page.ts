export const projectSettingsKey = (projectId: string | null) => ['project-settings', projectId];

export interface ProjectSettings {
  statusPagePublic: boolean;
}

export function canManageStatusPage(role: string | undefined): boolean {
  return (role ?? '').split(',').some((part) => ['owner', 'admin'].includes(part.trim()));
}

export function statusPageUrl(origin: string, orgSlug: string | null, projectSlug: string | null): string | null {
  if (!orgSlug || !projectSlug) return null;
  return origin + '/public/status/' + encodeURIComponent(orgSlug) + '/' + encodeURIComponent(projectSlug);
}
