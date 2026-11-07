import { z } from "zod";

export const CreateNotificationChannelDto = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["email", "slack", "webhook"]),
  // Email
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(100).optional(),
  recipientEmails: z.array(z.string().email()).default([]),
  // Slack
  slackChannelId: z.string().optional(),
  slackUserId: z.string().optional(),
  // Webhook
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().optional(),
  webhookTypes: z.array(z.string()).default([]),
});
export type CreateNotificationChannelInput = z.infer<
  typeof CreateNotificationChannelDto
>;

export const UpdateNotificationChannelDto = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  recipientEmails: z.array(z.string().email()).optional(),
  slackChannelId: z.string().optional(),
  slackUserId: z.string().optional(),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().optional(),
  webhookTypes: z.array(z.string()).optional(),
});
export type UpdateNotificationChannelInput = z.infer<
  typeof UpdateNotificationChannelDto
>;
