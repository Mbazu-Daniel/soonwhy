import { SCANNER_PROBE_PATTERNS, SCANNER_PROBE_STATUS } from "./scanner-probe.constants";
import type { ErrorGroup } from "./error.types";

function pathOf(message: string): string {
  const match = message.match(/^\S+\s+(\S+)/);
  const target = match?.[1] ?? "";
  return target.split("?")[0] ?? "";
}

export function isScannerProbe(group: Pick<ErrorGroup, "errorType" | "errorMessage">): boolean {
  if (group.errorType !== SCANNER_PROBE_STATUS) return false;
  const path = pathOf(group.errorMessage);
  return SCANNER_PROBE_PATTERNS.some((pattern) => pattern.test(path));
}
