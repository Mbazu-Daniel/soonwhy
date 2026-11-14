import { z } from "zod";

export const traceFilterShape = {
  projectId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().max(200).optional(),
  service: z.string().max(200).optional(),
  operation: z.string().max(300).optional(),
  status: z.enum(["ok", "error"]).optional(),
  minDuration: z.coerce.number().min(0).optional(),
  maxDuration: z.coerce.number().min(0).optional(),
};

export const getTracesSchema = z.object({
  ...traceFilterShape,
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

export const getTraceStatsSchema = z.object(traceFilterShape);

export type GetTracesInput = z.infer<typeof getTracesSchema>;
export type GetTraceStatsInput = z.infer<typeof getTraceStatsSchema>;
