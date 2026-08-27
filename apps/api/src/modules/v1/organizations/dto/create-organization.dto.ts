import { z } from 'zod';

export const CreateOrganizationDto = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationDto>;
