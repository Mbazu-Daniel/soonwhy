export interface EditableService {
  id: string;
  name: string;
  language: string | null;
  framework: string | null;
  repositoryUrl: string | null;
  repositoryProvider: string | null;
  repositoryBranch: string | null;
}

type FieldKey = 'language' | 'framework' | 'repositoryUrl' | 'repositoryProvider' | 'repositoryBranch';

export const SERVICE_FIELDS: Array<{ key: FieldKey; label: string; placeholder: string }> = [
  { key: 'language', label: 'Language', placeholder: 'TypeScript' },
  { key: 'framework', label: 'Framework', placeholder: 'NestJS' },
  { key: 'repositoryUrl', label: 'Repository URL', placeholder: 'https://github.com/org/repo' },
  { key: 'repositoryProvider', label: 'Repository provider', placeholder: 'GitHub' },
  { key: 'repositoryBranch', label: 'Default branch', placeholder: 'main' },
];

export function serviceChanges(service: EditableService, values: Record<string, string>) {
  const changes: Record<string, string | null> = {};
  for (const field of SERVICE_FIELDS) {
    const next = (values[field.key] ?? '').trim();
    if (next !== (service[field.key] ?? '')) changes[field.key] = next || null;
  }
  return changes;
}
