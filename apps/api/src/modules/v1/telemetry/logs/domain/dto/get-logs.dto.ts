import { z } from "zod";
import { DEFAULT_CONTEXT_LINES, DEFAULT_EXPORT_ROWS, MAX_CONTEXT_LINES, MAX_FIELD_VALUES, MAX_RESULT_WINDOW } from "../logs.constants";

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

export const getContextSchema = z.object({
  projectId: z.string().min(1),
  id: z.string().min(1).max(200),
  timestamp: z.string().datetime(),
  field: z.string().min(1).max(160),
  value: z.string().min(1).max(500),
  lines: z.coerce.number().int().min(1).max(MAX_CONTEXT_LINES).optional().default(DEFAULT_CONTEXT_LINES),
});

export const exportLogsSchema = getLogsSchema.omit({ cursor: true, limit: true }).extend({
  format: z.enum(["ndjson", "csv"]).optional().default("ndjson"),
  limit: z.coerce.number().int().min(1).max(MAX_RESULT_WINDOW).optional().default(DEFAULT_EXPORT_ROWS),
});

export type GetContextInput = z.infer<typeof getContextSchema>;
export type ExportLogsInput = z.infer<typeof exportLogsSchema>;
export type GetLogsInput = z.infer<typeof getLogsSchema>;
export type GetFieldValuesInput = z.infer<typeof getFieldValuesSchema>;
