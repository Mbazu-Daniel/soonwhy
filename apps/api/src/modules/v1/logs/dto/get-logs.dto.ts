import { z } from 'zod';

export const getLogsSchema = z.object({
  projectId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal', 'all']).optional().default('all'),
  service: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

export type GetLogsInput = z.infer<typeof getLogsSchema>;
