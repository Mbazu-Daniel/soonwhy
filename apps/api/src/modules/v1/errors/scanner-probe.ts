import { SCANNER_PROBE_PATTERNS, SCANNER_PROBE_STATUS } from "./scanner-probe.constants";
import { pathOf } from "./error-path";
import type { ErrorGroup } from "./error.types";

export function isScannerProbe(group: Pick<ErrorGroup, "errorType" | "errorMessage">): boolean {
  if (group.errorType !== SCANNER_PROBE_STATUS) return false;
  const path = pathOf(group.errorMessage);
  return SCANNER_PROBE_PATTERNS.some((pattern) => pattern.test(path));
}
