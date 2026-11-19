import type { z } from "zod";
import type { FindingListQuerySchema, FindingStatusBodySchema } from "./finding.schema";

export type FindingListQuery = z.infer<typeof FindingListQuerySchema>;
export type FindingStatusBody = z.infer<typeof FindingStatusBodySchema>;

export interface FindingSummaryRow {
  category: string;
  status: string;
  severity: string;
  count: number;
}
