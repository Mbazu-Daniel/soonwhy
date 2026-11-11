import { z } from "zod";

export const WeeklySummaryRequestSchema = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    summary: z.record(z.string(), z.unknown()),
  })
  .strict();

export type WeeklySummaryRequestInput = z.infer<typeof WeeklySummaryRequestSchema>;
