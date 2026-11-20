import {
  DEEP_NESTING_LEVELS, LARGE_PAYLOAD_BYTES, REQUEST_BODY_KEY, RESPONSE_BODY_KEY, SENSITIVE_FIELD_PATTERN, UNBOUNDED_LIST_LENGTH,
} from "./trace-payloads.constants";
import type { PayloadIssue, PayloadReport, PayloadShape, PayloadSide, PayloadSpan } from "./trace-payloads.types";

type Walk = { fieldCount: number; maxDepth: number; sensitive: string[]; lists: Array<{ path: string; length: number }> };

function walk(shape: PayloadShape, path: string, depth: number, out: Walk) {
  out.maxDepth = Math.max(out.maxDepth, depth);
  if (shape.type === "array") {
    if (shape.length >= UNBOUNDED_LIST_LENGTH) out.lists.push({ path: path || "$", length: shape.length });
    if (shape.items) walk(shape.items, `${path}[]`, depth + 1, out);
  } else if (shape.type === "object") {
    for (const [key, child] of Object.entries(shape.fields)) {
      out.fieldCount += 1;
      const childPath = path ? `${path}.${key}` : key;
      if (SENSITIVE_FIELD_PATTERN.test(key)) out.sensitive.push(childPath);
      walk(child, childPath, depth + 1, out);
    }
  }
}

function parse(value: unknown): { bytes: number; format: "json" | "text"; shape?: PayloadShape } | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as { bytes?: unknown; format?: unknown; shape?: PayloadShape };
    if (typeof parsed.bytes !== "number") return null;
    return { bytes: parsed.bytes, format: parsed.format === "json" ? "json" : "text", shape: parsed.shape };
  } catch {
    return null;
  }
}

function reportFor(span: PayloadSpan, side: PayloadSide, raw: unknown): PayloadReport | null {
  const stored = parse(raw);
  if (!stored) return null;
  const out: Walk = { fieldCount: 0, maxDepth: 0, sensitive: [], lists: [] };
  if (stored.shape) walk(stored.shape, "", 0, out);

  const issues: PayloadIssue[] = [];
  if (stored.bytes >= LARGE_PAYLOAD_BYTES) {
    issues.push({ kind: "large", side, message: `The ${side} body is ${Math.round(stored.bytes / 1000)} KB. Send less data or compress it.` });
  }
  for (const path of out.sensitive) {
    const advice = side === "response" ? "Do not return it to the client." : "Make sure it is sent over TLS and never logged.";
    issues.push({ kind: "sensitive_field", side, path, message: `The ${side} carries "${path}", which looks sensitive. ${advice}` });
  }
  for (const list of out.lists) {
    issues.push({ kind: "unbounded_list", side, path: list.path, message: `"${list.path}" holds ${list.length} items in one ${side}. Paginate it.` });
  }
  if (out.maxDepth >= DEEP_NESTING_LEVELS) {
    issues.push({ kind: "deep_nesting", side, message: `The ${side} is nested ${out.maxDepth} levels deep. Flatten it to cut parsing cost.` });
  }
  return { spanId: span.spanId, operation: span.name, side, bytes: stored.bytes, format: stored.format, fieldCount: out.fieldCount, issues };
}

export function analyzeTracePayloads(spans: PayloadSpan[]): PayloadReport[] {
  const reports: PayloadReport[] = [];
  for (const span of spans) {
    const request = reportFor(span, "request", span.attributes?.[REQUEST_BODY_KEY]);
    const response = reportFor(span, "response", span.attributes?.[RESPONSE_BODY_KEY]);
    if (request) reports.push(request);
    if (response) reports.push(response);
  }
  return reports.sort((a, b) => b.issues.length - a.issues.length || b.bytes - a.bytes);
}
