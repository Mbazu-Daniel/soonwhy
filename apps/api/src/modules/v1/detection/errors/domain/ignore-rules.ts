import { pathOf } from "./error-path";
import type { IgnoreRuleMatcher } from "./ignore-rules.types";
import type { ErrorGroup } from "./error.types";

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`, "i");
}

function statusOf(errorType: string): string {
  return errorType.replace(/^HTTP\s+/i, "").trim();
}

export function matchesIgnoreRule(
  group: Pick<ErrorGroup, "errorType" | "errorMessage">,
  rule: IgnoreRuleMatcher,
): boolean {
  if (rule.status && statusOf(group.errorType) !== rule.status.trim()) return false;
  const path = pathOf(group.errorMessage);
  if (!path) return false;
  return globToRegExp(rule.pathPattern).test(path);
}

export function isIgnoredByRules(
  group: Pick<ErrorGroup, "errorType" | "errorMessage">,
  rules: readonly IgnoreRuleMatcher[],
): boolean {
  return rules.some((rule) => matchesIgnoreRule(group, rule));
}

export function rulesFingerprint(rules: readonly IgnoreRuleMatcher[]): string {
  return rules.map((rule) => `${rule.pathPattern}|${rule.status ?? ""}`).sort().join(",");
}
