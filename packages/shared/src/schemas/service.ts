import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
