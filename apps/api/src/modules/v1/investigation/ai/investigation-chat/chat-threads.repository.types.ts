import type { ChatMessageRole, ChatMessageStatus, ChatMessageStep } from "../../../../../common/db/schema";

export interface ThreadScope {
  orgId: string;
  projectId: string;
  userId: string;
}

export interface NewChatMessage {
  threadId: string;
  role: ChatMessageRole;
  content: string;
  steps?: ChatMessageStep[];
  status?: ChatMessageStatus;
  totalTokens?: number;
}
