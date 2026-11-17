import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../../../common/db";
import { autoAnalysisSettings } from "../../../common/db/schema/auto-analysis-settings";
import { projects } from "../../../common/db/schema/projects";
import { rcaAnalyses } from "../../../common/db/schema/rca-analyses";
import { DEFAULT_DAILY_CAP, DEFAULT_MIN_OCCURRENCES } from "./auto-analysis.constants";
import type { AutoAnalysisSettings } from "./auto-analysis.types";

export const DEFAULT_SETTINGS: AutoAnalysisSettings = {
  enabled: false,
  dailyCap: DEFAULT_DAILY_CAP,
  minOccurrences: DEFAULT_MIN_OCCURRENCES,
};

export async function getSettings(orgId: string): Promise<AutoAnalysisSettings> {
  const [row] = await db
    .select({
      enabled: autoAnalysisSettings.enabled,
      dailyCap: autoAnalysisSettings.dailyCap,
      minOccurrences: autoAnalysisSettings.minOccurrences,
    })
    .from(autoAnalysisSettings)
    .where(eq(autoAnalysisSettings.orgId, orgId))
    .limit(1);
  return row ?? DEFAULT_SETTINGS;
}

export async function saveSettings(
  orgId: string,
  patch: Partial<AutoAnalysisSettings>,
): Promise<AutoAnalysisSettings> {
  const next = { ...(await getSettings(orgId)), ...patch };
  await db
    .insert(autoAnalysisSettings)
    .values({ orgId, ...next })
    .onConflictDoUpdate({ target: autoAnalysisSettings.orgId, set: { ...next, updatedAt: new Date() } });
  return next;
}

export async function listEnabledOrgIds(): Promise<string[]> {
  const rows = await db
    .select({ orgId: autoAnalysisSettings.orgId })
    .from(autoAnalysisSettings)
    .where(eq(autoAnalysisSettings.enabled, true));
  return rows.map((row) => row.orgId);
}

export async function listProjectIds(orgId: string): Promise<string[]> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.organizationId, orgId));
  return rows.map((row) => row.id);
}

export async function countAutoAnalysesSince(orgId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(rcaAnalyses)
    .where(
      and(eq(rcaAnalyses.orgId, orgId), eq(rcaAnalyses.trigger, "auto"), eq(rcaAnalyses.credentialSource, "platform"), gte(rcaAnalyses.createdAt, since)),
    );
  return row?.total ?? 0;
}
