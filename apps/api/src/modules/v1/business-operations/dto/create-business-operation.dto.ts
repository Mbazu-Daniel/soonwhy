import { z } from 'zod';

export const CreateBusinessOperationDto = z.object({
  name: z.string().min(1).max(150),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  serviceId: z.string().min(1),
  environmentId: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']).optional(),
  routePattern: z.string().max(500).optional(),
  criticality: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  sloMetric: z.enum(['latency', 'availability', 'error_rate']).optional(),
  sloTarget: z.number().positive().optional(),
  sloUnit: z.string().max(32).optional(),
}).superRefine((input, ctx) => {
  if (input.sloTarget !== undefined && input.sloMetric === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sloMetric is required when sloTarget is provided', path: ['sloMetric'] });
  }
  if (input.sloMetric !== undefined && input.sloTarget === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sloTarget is required when sloMetric is provided', path: ['sloTarget'] });
  }
  if (input.sloMetric === 'latency' && input.sloUnit !== undefined && !['ms', 's'].includes(input.sloUnit)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'latency SLO unit must be ms or s', path: ['sloUnit'] });
  }
  if (input.sloMetric === 'availability' && input.sloUnit !== undefined && input.sloUnit !== '%') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'availability SLO unit must be %', path: ['sloUnit'] });
  }
  if (input.sloMetric === 'error_rate' && input.sloUnit !== undefined && input.sloUnit !== '%') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'error_rate SLO unit must be %', path: ['sloUnit'] });
  }
  if (['availability', 'error_rate'].includes(input.sloMetric ?? '') && input.sloTarget !== undefined && input.sloTarget > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'percentage SLO target must be at most 100', path: ['sloTarget'] });
  }
});

export type CreateBusinessOperationInput = z.infer<typeof CreateBusinessOperationDto>;
