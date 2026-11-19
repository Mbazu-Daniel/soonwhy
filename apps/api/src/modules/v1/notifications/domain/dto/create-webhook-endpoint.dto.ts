import { z } from "zod";
import { publicHttpUrl } from "../../../../../common/net/public-url.dto";

export const CreateWebhookEndpointDto = z.object({
  name: z.string().min(1).max(100),
  url: publicHttpUrl,
  secret: z.string().optional(),
  types: z.array(z.string()).default([]),
});
export type CreateWebhookEndpointInput = z.infer<
  typeof CreateWebhookEndpointDto
>;

export const UpdateWebhookEndpointDto = z.object({
  name: z.string().min(1).max(100).optional(),
  url: publicHttpUrl.optional(),
  secret: z.string().optional(),
  types: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWebhookEndpointInput = z.infer<
  typeof UpdateWebhookEndpointDto
>;
