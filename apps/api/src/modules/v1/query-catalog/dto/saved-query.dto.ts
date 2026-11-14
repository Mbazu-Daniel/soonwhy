import { z } from "zod";

export const MAX_SAVED_QUERY_BYTES = 8000;

export const SavedQueryDto = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  dataType: z.enum(["logs", "traces", "metrics"]),
  query: z
    .record(z.string(), z.unknown())
    .refine((value) => JSON.stringify(value).length <= MAX_SAVED_QUERY_BYTES, {
      message: `Saved query must be smaller than ${MAX_SAVED_QUERY_BYTES} characters`,
    }),
});

export type SavedQueryInput = z.infer<typeof SavedQueryDto>;
