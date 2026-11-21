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

export const updateRetentionPolicyBodySchema = z.object({
  retentionDays: retentionDays.optional(),
  maxStorageGb: z.number().optional(),
  autoCleanup: z.boolean().optional(),
  cleanupSchedule: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const exportRetentionDataBodySchema = z.object({
  dataType,
  beforeDate: z.string().datetime(),
});
