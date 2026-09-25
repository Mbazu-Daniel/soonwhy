import { z } from 'zod';

export const CreateServiceDto = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  language: z.string().max(80).optional(),
  framework: z.string().max(120).optional(),
  repositoryUrl: z.string().url().max(500).optional(),
  repositoryProvider: z.string().max(40).optional(),
  repositoryBranch: z.string().max(200).optional(),
  ownerId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
});

export type CreateServiceInput = z.infer<typeof CreateServiceDto>;
