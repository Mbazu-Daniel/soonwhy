import { z } from 'zod';

export const getMetricsSchema = z.object({
  projectId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  interval: z.enum(['1m', '5m', '1h', '1d']).optional().default('5m'),
  service: z.string().optional(),
});

export type GetMetricsInput = z.infer<typeof getMetricsSchema>;
