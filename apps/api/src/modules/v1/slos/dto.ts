import { z } from "zod";

export const createSloBodySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  serviceName: z.string(),
  targetPercentage: z.number(),
  period: z.string(),
  measurementType: z.string(),
  goodEventsThreshold: z.number().optional(),
  windowSize: z.number().optional(),
  alertOnBurnRate: z.boolean().optional(),
  alertThresholds: z.record(z.unknown()).optional(),
});

export type CreateSloBody = z.infer<typeof createSloBodySchema>;

export const updateSloBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  targetPercentage: z.number().optional(),
  period: z.string().optional(),
  measurementType: z.string().optional(),
  goodEventsThreshold: z.number().optional(),
  windowSize: z.number().optional(),
  alertOnBurnRate: z.boolean().optional(),
  alertThresholds: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSloBody = z.infer<typeof updateSloBodySchema>;
