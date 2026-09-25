import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { EnvironmentsService } from './environments.service';

describe('EnvironmentsService', () => {
  const repository = {
    list: vi.fn(),
    findBySlug: vi.fn(),
    create: vi.fn(),
  };

  it('keeps environment reads scoped to the organization', async () => {
    repository.list.mockResolvedValue([{ environment: { id: 'env-1', projectId: 'project-1' } }]);
    const service = new EnvironmentsService(repository as never);

    await expect(service.list('project-1', 'org-1')).resolves.toEqual([
      { id: 'env-1', projectId: 'project-1' },
    ]);
    expect(repository.list).toHaveBeenCalledWith('project-1', 'org-1');
  });

  it('rejects duplicate environment slugs in a project', async () => {
    repository.findBySlug.mockResolvedValue({ id: 'env-1' });
    const service = new EnvironmentsService(repository as never);

    await expect(service.create('project-1', 'org-1', {
      name: 'Production',
      slug: 'production',
      kind: 'production',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
