import type { CoreMessage } from "@mastra/core/llm";
import { CHAT_MAX_HISTORY_CHARS } from "./investigation-chat.constants";

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  status: "complete" | "failed" | "cancelled";
}

export function toModelHistory(rows: StoredMessage[]): CoreMessage[] {
  return rows
    .filter((row) => row.role === "user" || (row.status === "complete" && row.content.length > 0))
    .map((row) => ({ role: row.role, content: row.content.slice(0, CHAT_MAX_HISTORY_CHARS) }));
}
