import { NEVER_ANALYZED_STATUS, SERVER_ERROR_FLOOR } from "./auto-analysis.constants";
import type { ErrorGroupSummary } from "../../../detection/errors/domain/error.types";

function httpStatusOf(errorType: string): number | null {
  const match = errorType.match(/^HTTP\s+(\d{3})$/i);
  return match ? Number(match[1]) : null;
}

export function isMeaningfulGroup(
  group: Pick<ErrorGroupSummary, "errorType" | "count" | "scannerProbe" | "issue">,
  minOccurrences: number,
): boolean {
  if (group.scannerProbe) return false;
  if (group.issue.status === "resolved" || group.issue.status === "ignored") return false;
  const status = httpStatusOf(group.errorType);
  if (status === null) return true;
  if (status === NEVER_ANALYZED_STATUS) return false;
  if (status >= SERVER_ERROR_FLOOR) return true;
  return group.count >= minOccurrences;
}
