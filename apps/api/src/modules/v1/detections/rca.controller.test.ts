import { describe, expect, it, vi } from 'vitest';
import { RcaController } from './rca.controller';

const org = { orgId: 'org_1', userRole: 'owner' };

describe('RcaController', () => {
  it('gets the latest RCA for the current organization', async () => {
    const rcaApi = {
      getLatest: vi.fn().mockResolvedValue({ id: 'rca_1' }),
      getHistory: vi.fn(),
      generate: vi.fn(),
    };
    const controller = new RcaController(rcaApi);

    await expect(controller.getLatest(
      org,
      'project_1',
      'finding_1',
    )).resolves.toEqual({ id: 'rca_1' });

    expect(rcaApi.getLatest).toHaveBeenCalledWith('org_1', 'project_1', 'finding_1');
  });

  it('passes the regenerate flag to generation', async () => {
    const rcaApi = {
      getLatest: vi.fn(),
      getHistory: vi.fn(),
      generate: vi.fn().mockResolvedValue({ id: 'rca_2' }),
    };
    const controller = new RcaController(rcaApi);

    await expect(controller.generate(
      org,
      'project_1',
      'finding_1',
      { regenerate: true },
    )).resolves.toEqual({ id: 'rca_2' });

    expect(rcaApi.generate).toHaveBeenCalledWith(
      'org_1',
      'project_1',
      'finding_1',
      true,
    );
  });

  it('rejects unknown request fields', () => {
    const controller = new RcaController({
      getLatest: vi.fn(),
      getHistory: vi.fn(),
      generate: vi.fn(),
    });

    expect(() => controller.generate(
      org,
      'project_1',
      'finding_1',
      { unexpected: true },
    )).toThrow();
  });
});
