import { z } from "zod";

export const CreateSyntheticProbeDto = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"]).default("GET"),
  headers: z.record(z.string()).default({}),
  body: z.string().optional(),
  expectedStatusCode: z.number().int().min(100).max(599).default(200),
  timeoutMs: z.number().int().min(1000).max(300000).default(30000),
  intervalSeconds: z.number().int().min(10).max(3600).default(60),
  region: z.string().default("us-east-1"),
});

export type CreateSyntheticProbeInput = z.infer<typeof CreateSyntheticProbeDto>;

export const UpdateSyntheticProbeDto = CreateSyntheticProbeDto.partial().extend({
  enabled: z.boolean().optional(),
});

export type UpdateSyntheticProbeInput = z.infer<typeof UpdateSyntheticProbeDto>;
