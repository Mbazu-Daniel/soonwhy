import { z } from 'zod';

export const getTracesSchema = z.object({
  projectId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  q: z.string().max(200).optional(),
  service: z.string().max(200).optional(),
});

export type GetTracesInput = z.infer<typeof getTracesSchema>;
