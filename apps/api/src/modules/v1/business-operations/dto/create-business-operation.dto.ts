import { z } from 'zod';

export const CreateBusinessOperationDto = z.object({
  name: z.string().min(1).max(150),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  serviceId: z.string().min(1),
  environmentId: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
  method: z.string().max(16).optional(),
  routePattern: z.string().max(500).optional(),
  criticality: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  sloMetric: z.enum(['latency', 'availability', 'error_rate']).optional(),
  sloTarget: z.number().positive().optional(),
  sloUnit: z.string().max(32).optional(),
}).refine(
  (input) => input.sloTarget === undefined || input.sloMetric !== undefined,
  { message: 'sloMetric is required when sloTarget is provided', path: ['sloMetric'] },
);

export type CreateBusinessOperationInput = z.infer<typeof CreateBusinessOperationDto>;
