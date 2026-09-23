import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ServicesService } from './services.service';

describe('ServicesService', () => {
  const repository = {
    getServiceById: vi.fn(),
    getServicesByProjectId: vi.fn(),
    getServiceByProjectAndSlug: vi.fn(),
    projectBelongsToOrg: vi.fn(),
    referencesBelongToOrg: vi.fn(),
    createService: vi.fn(),
    deleteService: vi.fn(),
  };

  it('requires the tenant when reading a service', async () => {
    repository.getServiceById.mockResolvedValue({ id: 'service-1', orgId: 'org-1' });
    const service = new ServicesService(repository as never);

    await expect(service.getServiceById('service-1', 'org-1')).resolves.toMatchObject({ orgId: 'org-1' });
    expect(repository.getServiceById).toHaveBeenCalledWith('service-1', 'org-1');
  });

  it('rejects service creation for a project outside the tenant', async () => {
    repository.projectBelongsToOrg.mockResolvedValue(false);
    const service = new ServicesService(repository as never);

    await expect(service.createService('project-2', 'org-1', {
      name: 'API',
      slug: 'api',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createService).not.toHaveBeenCalled();
  });

  it('rejects owner or team references outside the tenant', async () => {
    repository.projectBelongsToOrg.mockResolvedValue(true);
    repository.referencesBelongToOrg.mockResolvedValue(false);
    const service = new ServicesService(repository as never);

    await expect(service.createService('project-1', 'org-1', {
      name: 'API',
      slug: 'api',
      ownerId: 'user-2',
      teamId: 'team-2',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createService).not.toHaveBeenCalled();
  });

  it('rejects duplicate service slugs within a tenant project', async () => {
    repository.projectBelongsToOrg.mockResolvedValue(true);
    repository.referencesBelongToOrg.mockResolvedValue(true);
    repository.getServiceByProjectAndSlug.mockResolvedValue({ id: 'existing' });
    const service = new ServicesService(repository as never);

    await expect(service.createService('project-1', 'org-1', {
      name: 'API',
      slug: 'api',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createService).not.toHaveBeenCalled();
  });

  it('persists application metadata with the tenant context', async () => {
    repository.projectBelongsToOrg.mockResolvedValue(true);
    repository.referencesBelongToOrg.mockResolvedValue(true);
    repository.getServiceByProjectAndSlug.mockResolvedValue(undefined);
    repository.createService.mockResolvedValue({ id: 'service-1' });
    const service = new ServicesService(repository as never);

    await service.createService('project-1', 'org-1', {
      name: 'API',
      slug: 'api',
      language: 'TypeScript',
      framework: 'NestJS',
      repositoryUrl: 'https://github.com/example/api',
      repositoryProvider: 'github',
      repositoryBranch: 'main',
    });

    expect(repository.createService).toHaveBeenCalledWith({
      projectId: 'project-1',
      orgId: 'org-1',
      name: 'API',
      slug: 'api',
      language: 'TypeScript',
      framework: 'NestJS',
      repositoryUrl: 'https://github.com/example/api',
      repositoryProvider: 'github',
      repositoryBranch: 'main',
    });
  });
});
