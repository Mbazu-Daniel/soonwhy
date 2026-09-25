import { z } from 'zod';

export const CreateEnvironmentDto = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  kind: z.enum(['production', 'staging', 'development', 'preview']).default('production'),
});
export type CreateEnvironmentInput = z.infer<typeof CreateEnvironmentDto>;
