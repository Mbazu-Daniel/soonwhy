import { z } from 'zod';

export const CreateTeamDto = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
export type CreateTeamInput = z.infer<typeof CreateTeamDto>;
