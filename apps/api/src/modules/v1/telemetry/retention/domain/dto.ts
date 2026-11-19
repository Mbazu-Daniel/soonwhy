import { z } from "zod";
import { MAX_RETENTION_DAYS, RETENTION_DATA_TYPES } from "./retention.constants";

const dataType = z.enum(RETENTION_DATA_TYPES);
const retentionDays = z.number().int().min(1).max(MAX_RETENTION_DAYS);

export const createRetentionPolicyBodySchema = z.object({
  dataType,
  retentionDays,
  maxStorageGb: z.number().optional(),
  autoCleanup: z.boolean().optional(),
  cleanupSchedule: z.string().optional(),
});

type CreateRetentionPolicyBody = z.infer<
  typeof createRetentionPolicyBodySchema
>;

export const updateRetentionPolicyBodySchema = z.object({
  retentionDays: retentionDays.optional(),
  maxStorageGb: z.number().optional(),
  autoCleanup: z.boolean().optional(),
  cleanupSchedule: z.string().optional(),
  isActive: z.boolean().optional(),
});

type UpdateRetentionPolicyBody = z.infer<
  typeof updateRetentionPolicyBodySchema
>;

export const exportRetentionDataBodySchema = z.object({
  dataType,
  beforeDate: z.string().datetime(),
});

type ExportRetentionDataBody = z.infer<typeof exportRetentionDataBodySchema>;
