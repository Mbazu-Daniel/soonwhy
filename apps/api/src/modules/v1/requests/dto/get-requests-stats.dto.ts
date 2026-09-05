import { z } from 'zod';

export const getRequestsStatsSchema = z.object({
  projectId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type GetRequestsStatsInput = z.infer<typeof getRequestsStatsSchema>;
