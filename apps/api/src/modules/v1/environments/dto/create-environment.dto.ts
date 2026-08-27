import { z } from 'zod';

export const CreateEnvironmentDto = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
});

export type CreateEnvironmentInput = z.infer<typeof CreateEnvironmentDto>;
