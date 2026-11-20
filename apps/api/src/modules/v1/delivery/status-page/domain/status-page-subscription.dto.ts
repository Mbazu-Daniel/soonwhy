import { z } from "zod";
import { publicHttpUrl } from "../../../../../common/net/public-url.dto";

export const SubscribeToStatusPageDto = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  slackWebhookUrl: publicHttpUrl.optional(),
});
export type SubscribeToStatusPageInput = z.infer<typeof SubscribeToStatusPageDto>;
