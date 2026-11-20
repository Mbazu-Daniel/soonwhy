import { z } from "zod";
import { MAX_DAILY_CAP, MAX_MIN_OCCURRENCES } from "./auto-analysis.constants";

export const AutoAnalysisSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    dailyCap: z.number().int().min(1).max(MAX_DAILY_CAP).optional(),
    minOccurrences: z.number().int().min(2).max(MAX_MIN_OCCURRENCES).optional(),
  })
  .strict();

export type AutoAnalysisSettingsInput = z.output<typeof AutoAnalysisSettingsSchema>;
