import { describe, expect, it } from 'vitest';
import { serviceChanges, type EditableService } from './service-fields';

const service: EditableService = {
  id: 's1',
  name: 'api',
  language: 'TypeScript',
  framework: null,
  repositoryUrl: null,
  repositoryProvider: null,
  repositoryBranch: 'main',
};

describe('serviceChanges', () => {
  it('is empty when nothing changed', () => {
    expect(serviceChanges(service, { language: 'TypeScript', branch: 'x', repositoryBranch: 'main' })).toEqual({});
  });

  it('includes only the fields that changed, trimmed', () => {
    expect(serviceChanges(service, { language: 'TypeScript', framework: '  NestJS ', repositoryBranch: 'main' })).toEqual({
      framework: 'NestJS',
    });
  });

  it('turns a cleared field into null', () => {
    expect(serviceChanges(service, { language: '', repositoryBranch: 'main' })).toEqual({ language: null });
  });

  it('treats a missing value as cleared', () => {
    expect(serviceChanges(service, {})).toEqual({ language: null, repositoryBranch: null });
  });
});
