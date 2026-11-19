import { z } from "zod";
import { API_KEY_SCOPES } from "../api-keys.constants";

export const CreateApiKeyDto = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(API_KEY_SCOPES)).optional().default([]),
  expiresAt: z.string().datetime().optional(),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeyDto>;
