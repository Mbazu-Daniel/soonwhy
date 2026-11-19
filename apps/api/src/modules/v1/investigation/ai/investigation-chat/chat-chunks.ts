import type { ChatEvent } from "./investigation-chat.types";

interface MastraChunk {
  type: string;
  payload?: unknown;
}

function resultDetail(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const { status, reason } = result as { status?: unknown; reason?: unknown };
  if (status === "empty") return typeof reason === "string" ? reason : "No matching data.";
  if (status === "unavailable") return "Query failed. This is not the same as no data.";
  return undefined;
}

export function eventOf(chunk: MastraChunk): ChatEvent | null {
  const payload = (chunk.payload ?? {}) as Record<string, unknown>;
  const id = String(payload.toolCallId ?? "");
  const tool = String(payload.toolName ?? "");
  if (chunk.type === "text-delta" && typeof payload.text === "string") return { type: "text", delta: payload.text };
  if (chunk.type === "tool-call") return { type: "step", id, tool, status: "running" };
  if (chunk.type === "tool-result") {
    const detail = resultDetail(payload.result);
    const failed = (payload.result as { status?: unknown } | undefined)?.status === "unavailable";
    return { type: "step", id, tool, status: failed ? "failed" : "complete", ...(detail ? { detail } : {}) };
  }
  if (chunk.type === "tool-error") return { type: "step", id, tool, status: "failed", detail: "The tool could not run." };
  return null;
}
