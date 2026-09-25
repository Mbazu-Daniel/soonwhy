import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BusinessOperationsService } from './business-operations.service';
import type { BusinessOperationsRepository } from './business-operations.repository';

describe('BusinessOperationsService', () => {
  const repository = {
    list: vi.fn(),
    getById: vi.fn(),
    findBySlug: vi.fn(),
    validateContext: vi.fn(),
    create: vi.fn(),
  } as unknown as BusinessOperationsRepository;

  let service: BusinessOperationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BusinessOperationsService(repository);
  });

  it('rejects a service outside the tenant/project context', async () => {
    vi.mocked(repository.validateContext).mockResolvedValue(false);

    await expect(service.create('project-1', 'org-1', {
      name: 'Checkout',
      slug: 'checkout',
      serviceId: 'service-2',
      criticality: 'high',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects duplicate operation slugs', async () => {
    vi.mocked(repository.validateContext).mockResolvedValue(true);
    vi.mocked(repository.findBySlug).mockResolvedValue({ id: 'operation-1' } as never);

    await expect(service.create('project-1', 'org-1', {
      name: 'Checkout',
      slug: 'checkout',
      serviceId: 'service-1',
      criticality: 'high',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates an operation with validated business context', async () => {
    vi.mocked(repository.validateContext).mockResolvedValue(true);
    vi.mocked(repository.findBySlug).mockResolvedValue(undefined);
    vi.mocked(repository.create).mockResolvedValue({ id: 'operation-1', name: 'Checkout' } as never);

    await expect(service.create('project-1', 'org-1', {
      name: 'Checkout',
      slug: 'checkout',
      serviceId: 'service-1',
      environmentId: 'production',
      method: 'POST',
      routePattern: '/checkout',
      criticality: 'critical',
      sloMetric: 'latency',
      sloTarget: 1000,
      sloUnit: 'ms',
    })).resolves.toMatchObject({ id: 'operation-1' });
  });
});
