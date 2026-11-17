import { z } from "zod";

const SuppressionConditionsSchema = z.object({
  services: z.array(z.string()).optional(),
  severity: z.array(z.string()).optional(),
  timeRanges: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
        daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
      }),
    )
    .optional(),
  custom: z
    .array(z.object({ field: z.string(), operator: z.string(), value: z.unknown() }))
    .optional(),
});

export const CreateSuppressionRuleDto = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  conditions: SuppressionConditionsSchema,
  targetAlertRuleIds: z.array(z.string()).optional(),
  targetServices: z.array(z.string()).optional(),
  scheduleType: z.enum(["always", "scheduled", "conditional"]),
  scheduleConfig: z.record(z.string(), z.unknown()).optional(),
  conditionalConfig: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateSuppressionRuleDto = CreateSuppressionRuleDto.partial().extend({
  enabled: z.boolean().optional(),
});

export const CheckSuppressionDto = z.object({
  alertRuleId: z.string().min(1),
  service: z.string(),
  severity: z.string(),
});

export type CreateSuppressionRuleInput = z.output<typeof CreateSuppressionRuleDto>;
export type UpdateSuppressionRuleInput = z.output<typeof UpdateSuppressionRuleDto>;
export type CheckSuppressionInput = z.output<typeof CheckSuppressionDto>;
