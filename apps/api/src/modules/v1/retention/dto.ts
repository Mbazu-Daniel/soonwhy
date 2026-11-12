import { z } from "zod";

export const createRetentionPolicyBodySchema = z.object({
  dataType: z.string(),
  retentionDays: z.number(),
  maxStorageGb: z.number().optional(),
  autoCleanup: z.boolean().optional(),
  cleanupSchedule: z.string().optional(),
});

export type CreateRetentionPolicyBody = z.infer<
  typeof createRetentionPolicyBodySchema
>;

export const updateRetentionPolicyBodySchema = z.object({
  retentionDays: z.number().optional(),
  maxStorageGb: z.number().optional(),
  autoCleanup: z.boolean().optional(),
  cleanupSchedule: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRetentionPolicyBody = z.infer<
  typeof updateRetentionPolicyBodySchema
>;

export const exportRetentionDataBodySchema = z.object({
  dataType: z.string(),
  beforeDate: z.string(),
});

export type ExportRetentionDataBody = z.infer<typeof exportRetentionDataBodySchema>;
