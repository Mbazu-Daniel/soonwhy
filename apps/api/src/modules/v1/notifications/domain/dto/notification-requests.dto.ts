import { z } from "zod";

export const DispatchAlertDto = z.object({
  incidentId: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string(),
  body: z.string(),
  htmlBody: z.string().optional(),
});

export type DispatchAlertInput = z.infer<typeof DispatchAlertDto>;

export const SlackConnectDto = z.object({
  code: z.string(),
});

export type SlackConnectInput = z.infer<typeof SlackConnectDto>;

export const AssignOwnerDto = z.object({
  ownerId: z.string(),
  ownerName: z.string(),
});

export type AssignOwnerInput = z.infer<typeof AssignOwnerDto>;
