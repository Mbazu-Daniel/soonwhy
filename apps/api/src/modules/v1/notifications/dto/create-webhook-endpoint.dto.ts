import { z } from "zod";

export const CreateWebhookEndpointDto = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  secret: z.string().optional(),
  types: z.array(z.string()).default([]),
});
export type CreateWebhookEndpointInput = z.infer<
  typeof CreateWebhookEndpointDto
>;

export const UpdateWebhookEndpointDto = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  secret: z.string().optional(),
  types: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWebhookEndpointInput = z.infer<
  typeof UpdateWebhookEndpointDto
>;
