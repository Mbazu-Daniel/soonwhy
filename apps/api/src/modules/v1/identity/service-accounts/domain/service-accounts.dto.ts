import { z } from "zod";

export const CreateServiceAccountDto = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
});

export const UpdateServiceAccountDto = z.object({
  disabled: z.boolean(),
});

export const CreateServiceAccountKeyDto = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.string().min(1).max(50)).max(20).optional().default([]),
  expiresAt: z.string().datetime().optional(),
});

export type CreateServiceAccountInput = z.infer<typeof CreateServiceAccountDto>;
export type CreateServiceAccountKeyInput = z.infer<typeof CreateServiceAccountKeyDto>;
