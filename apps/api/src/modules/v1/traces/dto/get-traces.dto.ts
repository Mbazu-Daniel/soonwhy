import { z } from "zod";
import { MAX_TRACE_IDS } from "../traces.constants";

export const traceFilterShape = {
  projectId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().max(200).optional(),
  traceIds: z
    .string()
    .max(MAX_TRACE_IDS * 65)
    .transform((value) => value.split(",").map((id) => id.trim()).filter(Boolean))
    .pipe(z.array(z.string().regex(/^[\w-]{1,64}$/)).max(MAX_TRACE_IDS))
    .optional(),
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
