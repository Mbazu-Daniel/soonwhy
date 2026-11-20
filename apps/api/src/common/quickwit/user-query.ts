import { BadRequestException } from "@nestjs/common";
import { MAX_USER_QUERY_LENGTH } from "./user-query.constants";

const SINGLE_QUOTE = /'/;
const TENANT_FIELD = /(^|[^\w.])(org_id|project_id)\s*:/i;
const QUICKWIT_FAILURE = /Quickwit request failed \(400\): ([\s\S]*)$/;

function outsideQuotes(query: string): { text: string; balanced: boolean } {
  let text = "";
  let quoted = false;
  for (let index = 0; index < query.length; index += 1) {
    const char = query[index]!;
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted) text += char;
  }
  return { text, balanced: !quoted };
}

function parenthesesBalanced(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

export function assertSafeUserQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "";
  if (trimmed.length > MAX_USER_QUERY_LENGTH) {
    throw new BadRequestException(`Query is longer than ${MAX_USER_QUERY_LENGTH} characters`);
  }
  const { text, balanced } = outsideQuotes(trimmed);
  if (SINGLE_QUOTE.test(trimmed)) throw new BadRequestException("Query cannot contain single quotes");
  if (!balanced) throw new BadRequestException("Query has an unclosed quote");
  if (!parenthesesBalanced(text)) throw new BadRequestException("Query has unbalanced parentheses");
  if (TENANT_FIELD.test(text)) {
    throw new BadRequestException("Query cannot filter on org_id or project_id");
  }
  return trimmed;
}

export function userQueryFailure(error: unknown): BadRequestException | undefined {
  const message = error instanceof Error ? error.message : "";
  const match = QUICKWIT_FAILURE.exec(message);
  if (!match) return undefined;
  let detail = match[1]!.trim();
  try {
    const parsed = JSON.parse(detail) as { message?: string };
    if (parsed.message) detail = parsed.message;
  } catch {
    detail = detail.slice(0, 300);
  }
  return new BadRequestException(`Invalid search query: ${detail}`);
}
