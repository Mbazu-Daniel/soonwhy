import type { IncomingMessage, ServerResponse } from "node:http";
import {
  JSON_CONTENT_TYPE, REQUEST_BODY_KEY, RESPONSE_BODY_KEY, SHAPE_MAX_DEPTH, SHAPE_MAX_FIELDS,
} from "./body-capture.constants.js";
import type { BodyCaptureOptions, BodySpan, CapturedBody, PayloadShape, StoredPayload } from "./body-capture.types.js";

function shapeOf(value: unknown, depth = 0): PayloadShape {
  if (value === null || value === undefined) return { type: "null" };
  if (Array.isArray(value)) {
    if (depth >= SHAPE_MAX_DEPTH) return { type: "deep" };
    return { type: "array", length: value.length, items: value.length ? shapeOf(value[0], depth + 1) : null };
  }
  if (typeof value === "object") {
    if (depth >= SHAPE_MAX_DEPTH) return { type: "deep" };
    const entries = Object.entries(value as Record<string, unknown>);
    const fields = Object.fromEntries(entries.slice(0, SHAPE_MAX_FIELDS).map(([key, item]) => [key, shapeOf(item, depth + 1)]));
    return entries.length > SHAPE_MAX_FIELDS ? { type: "object", fields, truncated: true } : { type: "object", fields };
  }
  if (typeof value === "number") return { type: "number" };
  if (typeof value === "boolean") return { type: "boolean" };
  return { type: "string" };
}

export function describeBody(body: CapturedBody, contentType: unknown, maxAttributeValueLength: number): StoredPayload | null {
  if (body.total === 0) return null;
  const text: StoredPayload = { bytes: body.total, format: "text" };
  if (body.size < body.total || typeof contentType !== "string" || !JSON_CONTENT_TYPE.test(contentType)) return text;
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(body.chunks).toString("utf8"));
    if (parsed === null || typeof parsed !== "object") return text;
    const stored: StoredPayload = { bytes: body.total, format: "json", shape: shapeOf(parsed) };
    return JSON.stringify(stored).length > maxAttributeValueLength ? { bytes: body.total, format: "json" } : stored;
  } catch {
    return text;
  }
}

function collect(body: CapturedBody, chunk: unknown, maxBytes: number, encoding?: unknown): void {
  if (chunk === null || chunk === undefined || typeof chunk === "function") return;
  const buffer = Buffer.isBuffer(chunk)
    ? chunk
    : typeof chunk === "string"
      ? Buffer.from(chunk, typeof encoding === "string" ? (encoding as BufferEncoding) : "utf8")
      : null;
  if (!buffer) return;
  body.total += buffer.length;
  if (body.size + buffer.length > maxBytes) return;
  body.chunks.push(buffer);
  body.size += buffer.length;
}

function publish(span: BodySpan, key: string, body: CapturedBody, contentType: unknown, options: BodyCaptureOptions): void {
  const stored = describeBody(body, contentType, options.maxAttributeValueLength);
  if (stored) span.setAttribute(key, JSON.stringify(stored));
}

export function captureBodies(span: BodySpan, response: ServerResponse, options: BodyCaptureOptions): void {
  const request = response.req as IncomingMessage | undefined;
  if (request && typeof request.push === "function") {
    const requestBody: CapturedBody = { chunks: [], size: 0, total: 0 };
    const push = request.push.bind(request);
    request.push = ((chunk: unknown, encoding?: BufferEncoding) => {
      collect(requestBody, chunk, options.maxBytes, encoding);
      return push(chunk as never, encoding);
    }) as typeof request.push;
    request.once("end", () => publish(span, REQUEST_BODY_KEY, requestBody, request.headers["content-type"], options));
  }

  const responseBody: CapturedBody = { chunks: [], size: 0, total: 0 };
  const write = response.write.bind(response) as (...args: unknown[]) => boolean;
  const end = response.end.bind(response) as (...args: unknown[]) => ServerResponse;
  response.write = ((chunk: unknown, encoding?: unknown, callback?: unknown) => {
    collect(responseBody, chunk, options.maxBytes, encoding);
    return write(chunk, encoding, callback);
  }) as typeof response.write;
  response.end = ((chunk?: unknown, encoding?: unknown, callback?: unknown) => {
    collect(responseBody, chunk, options.maxBytes, encoding);
    return end(chunk, encoding, callback);
  }) as typeof response.end;
  response.once("finish", () => publish(span, RESPONSE_BODY_KEY, responseBody, response.getHeader("content-type"), options));
}
