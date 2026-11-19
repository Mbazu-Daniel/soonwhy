import { sql } from "drizzle-orm";
import { findings } from "../../../../../common/db/schema";

export function recurrenceUpdate(seenAt: Date = new Date()) {
  const seen = sql`${seenAt.toISOString()}::timestamp`;
  const isNewer = sql`${seen} > ${findings.lastSeenAt}`;
  const reopens = sql`${findings.status} = 'resolved' and ${findings.resolvedAt} < ${seen}`;
  return {
    status: sql`case when ${reopens} then 'open' else ${findings.status} end`,
    resolvedAt: sql`case when ${reopens} then null else ${findings.resolvedAt} end`,
    resolvedBy: sql`case when ${reopens} then null else ${findings.resolvedBy} end`,
    occurrences: sql`case when ${isNewer} then ${findings.occurrences} + 1 else ${findings.occurrences} end`,
    lastSeenAt: sql`greatest(${findings.lastSeenAt}, ${seen})`,
  };
}
