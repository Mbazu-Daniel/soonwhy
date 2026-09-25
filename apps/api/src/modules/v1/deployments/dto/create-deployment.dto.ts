import { z } from 'zod';

export const CreateDeploymentDto = z.object({
  serviceId: z.string().min(1),
  environmentId: z.string().min(1),
  version: z.string().max(200).optional(),
  commitSha: z.string().max(200).optional(),
  status: z.enum(['active', 'failed', 'rolled_back']).default('active'),
  deployedAt: z.coerce.date().optional(),
});
export type CreateDeploymentInput = z.infer<typeof CreateDeploymentDto>;
