import { z } from "zod";

export const CreateCanaryDto = z.object({
  deploymentId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(200),
  targetUrl: z.string().url(),
  baselineUrl: z.string().url().optional(),
  validationRules: z
    .object({
      maxResponseTimeMs: z.number().positive().optional(),
      minSuccessRate: z.number().min(0).max(100).optional(),
      errorThreshold: z.number().min(0).optional(),
    })
    .optional(),
});

export type CreateCanaryInput = z.output<typeof CreateCanaryDto>;
