import type { ChatEvent } from "./investigation-chat.types";

export interface ChatSession {
  threadId: string;
  events: AsyncGenerator<ChatEvent>;
}
