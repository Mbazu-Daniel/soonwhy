import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../common/db', () => ({
  db: {
    insert: () => ({ values: () => ({ returning: vi.fn().mockResolvedValue([{ id: 'run-1' }]) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: vi.fn().mockResolvedValue([{ id: 'run-1' }]) }) }) }),
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) }) }),
  },
}));

import { completeDetectionRun, failDetectionRun, startDetectionRun } from './detection.run';

describe('detection run lifecycle', () => {
  it('creates a running run', async () => {
    await expect(startDetectionRun('org-1', 'project-1', new Date(), new Date()))
      .resolves.toMatchObject({ id: 'run-1' });
  });

  it('completes a run with the finding count', async () => {
    await expect(completeDetectionRun('run-1', 3))
      .resolves.toMatchObject({ id: 'run-1' });
  });

  it('records failures', async () => {
    await expect(failDetectionRun('run-1', 'Quickwit unavailable'))
      .resolves.toMatchObject({ id: 'run-1' });
  });
});
