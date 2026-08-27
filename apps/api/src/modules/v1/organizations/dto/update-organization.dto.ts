import { z } from 'zod';

export const UpdateOrganizationDto = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
});

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationDto>;
