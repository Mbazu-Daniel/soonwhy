import { z } from "zod";
import { publicHttpUrl } from "../../../../../common/net/public-url.dto";

export const CreateCanaryDto = z.object({
  deploymentId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(200),
  targetUrl: publicHttpUrl,
  baselineUrl: publicHttpUrl.optional(),
  validationRules: z
    .object({
      maxResponseTimeMs: z.number().positive().optional(),
      minSuccessRate: z.number().min(0).max(100).optional(),
      errorThreshold: z.number().min(0).optional(),
    })
    .optional(),
});

export type CreateCanaryInput = z.output<typeof CreateCanaryDto>;
