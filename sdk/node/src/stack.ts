import {
  CAUSE_PREFIX,
  MAX_CAUSE_DEPTH,
  STACK_BUDGET,
  STACK_SEPARATOR,
} from "./stack.constants.js";

function describe(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function shares(lengths: number[], budget: number): number[] {
  const result = lengths.map(() => 0);
  let open = lengths.map((_, index) => index);
  let remaining = budget;
  let settled = true;
  while (settled && open.length > 0) {
    settled = false;
    const fair = remaining / open.length;
    const next: number[] = [];
    for (const index of open) {
      if (lengths[index]! <= fair) {
        result[index] = lengths[index]!;
        remaining -= lengths[index]!;
        settled = true;
      } else next.push(index);
    }
    open = next;
  }
  for (const index of open) result[index] = Math.floor(remaining / open.length);
  return result;
}

function fit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const kept: string[] = [];
  let used = 0;
  for (const line of text.split("\n")) {
    const cost = line.length + (kept.length > 0 ? 1 : 0);
    if (used + cost > limit) break;
    kept.push(line);
    used += cost;
  }
  return kept.length > 0 ? kept.join("\n") : text.slice(0, limit);
}

export function formatErrorStack(error: Error, budget = STACK_BUDGET): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current !== undefined && current !== null && parts.length <= MAX_CAUSE_DEPTH && !seen.has(current)) {
    seen.add(current);
    parts.push(parts.length === 0 ? describe(current) : `${CAUSE_PREFIX}${describe(current)}`);
    current = current instanceof Error ? current.cause : undefined;
  }
  const separators = (parts.length - 1) * STACK_SEPARATOR.length;
  const allowed = shares(parts.map((part) => part.length), Math.max(0, budget - separators));
  return parts.map((part, index) => fit(part, allowed[index]!)).join(STACK_SEPARATOR);
}
