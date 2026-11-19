import { z } from "zod";
import { FINDING_CATEGORIES, FINDING_STATUSES } from "../../../../../common/db/schema/finding-lifecycle";
import { DEFAULT_FINDINGS_LIMIT, MAX_FINDINGS_LIMIT } from "./finding.constants";
import { REPORT_DEFAULT_DAYS, REPORT_MAX_DAYS } from "./finding-report.constants";

export const FindingStatusBodySchema = z.object({ status: z.enum(FINDING_STATUSES) }).strict();

export const FindingListQuerySchema = z.object({
  status: z.enum(FINDING_STATUSES).optional(),
  category: z.enum(FINDING_CATEGORIES).optional(),
  severity: z.enum(["warning", "critical"]).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_FINDINGS_LIMIT).default(DEFAULT_FINDINGS_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

export const FindingReportQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(REPORT_MAX_DAYS).default(REPORT_DEFAULT_DAYS),
});
