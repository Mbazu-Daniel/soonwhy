import type { FindingCategory } from "../../../../../common/db/schema/finding-lifecycle";

export interface ReportFinding {
  id: string;
  title: string;
  serviceName: string;
  category: FindingCategory;
  severity: string;
  occurrences: number;
  detectedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  recommendation: string | null;
}

export interface ReportRow {
  id: string;
  title: string;
  serviceName: string;
  category: FindingCategory;
  severity: string;
  status: string;
  occurrences: number;
  detectedAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
  recommendation: string | null;
}

export interface CategoryTotals {
  category: FindingCategory;
  open: number;
  resolved: number;
  ignored: number;
}

export interface FindingReport {
  generatedAt: string;
  period: { from: string; to: string };
  totals: { open: number; openCritical: number; ignored: number; newInPeriod: number; resolvedInPeriod: number };
  byCategory: CategoryTotals[];
  topOpen: ReportFinding[];
  resolved: ReportFinding[];
  services: Array<{ serviceName: string; open: number }>;
  markdown: string;
}

export interface ReportPeriod {
  from: Date;
  to: Date;
}
