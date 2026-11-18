import type { IgnoreRuleDraft } from './ignore-rules.types';

export function ignoreRuleProblem(draft: IgnoreRuleDraft): string | null {
  const path = draft.pathPattern.trim();
  if (!path.startsWith('/')) return 'The path must start with /';
  if (/^\/?\*+$/.test(path)) return 'A rule cannot match every path';
  const status = draft.status.trim();
  if (status && !/^[1-5]\d\d$/.test(status)) return 'Use a three-digit status such as 404';
  return null;
}

export function ignoreRuleBody(draft: IgnoreRuleDraft) {
  const status = draft.status.trim();
  return { pathPattern: draft.pathPattern.trim(), status: status || null };
}
