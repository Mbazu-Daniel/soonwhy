import { z } from "zod";
import { API_KEY_SCOPES } from "../api-keys.constants";

export const CreateApiKeyDto = z
  .object({
    name: z.string().min(1).max(100),
    scopes: z.array(z.enum(API_KEY_SCOPES)).optional().default([]),
    expiresAt: z.string().datetime().optional(),
  })
  .refine((input) => !input.scopes.includes("mcp:write") || input.scopes.includes("mcp:read"), {
    message: "mcp:write requires mcp:read",
    path: ["scopes"],
  });

export type CreateApiKeyInput = z.infer<typeof CreateApiKeyDto>;
