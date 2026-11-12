import { z } from "zod";

export const createMaintenanceWindowBodySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  affectedServices: z.array(z.string()).optional(),
  affectedAlertRules: z.array(z.string()).optional(),
  recurringSchedule: z.record(z.unknown()).optional(),
});

export type CreateMaintenanceWindowBody = z.infer<
  typeof createMaintenanceWindowBodySchema
>;

export const updateMaintenanceWindowBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  affectedServices: z.array(z.string()).optional(),
  affectedAlertRules: z.array(z.string()).optional(),
  recurringSchedule: z.record(z.unknown()).optional(),
});

export type UpdateMaintenanceWindowBody = z.infer<
  typeof updateMaintenanceWindowBodySchema
>;
