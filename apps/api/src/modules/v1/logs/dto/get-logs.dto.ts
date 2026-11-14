import { z } from "zod";
import { MAX_FIELD_VALUES } from "../logs.constants";

export const getLogsSchema = z.object({
  projectId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  level: z
    .enum(["debug", "info", "warn", "error", "fatal", "all"])
    .optional()
    .default("all"),
  service: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

export const getFieldValuesSchema = getLogsSchema.extend({
  field: z.string().min(1).max(160),
  size: z.coerce.number().int().min(1).max(MAX_FIELD_VALUES).optional().default(10),
});

export type GetLogsInput = z.infer<typeof getLogsSchema>;
export type GetFieldValuesInput = z.infer<typeof getFieldValuesSchema>;
