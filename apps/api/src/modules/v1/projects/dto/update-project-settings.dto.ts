import { z } from 'zod';

export const UpdateProjectSettingsDto = z.object({
  redactSensitiveData: z.boolean().optional(),
  captureRequestHeaders: z.boolean().optional(),
  captureRequestBody: z.boolean().optional(),
  captureResponseBody: z.boolean().optional(),
  maxAttributeCount: z.number().int().min(10).max(1000).optional(),
  maxAttributeValueLength: z.number().int().min(256).max(16384).optional(),
});

export type UpdateProjectSettingsInput = z.infer<typeof UpdateProjectSettingsDto>;
