import { z } from "zod";
import { CHAT_MAX_MESSAGE_CHARS } from "./investigation-chat.constants";

export const InvestigationChatSchema = z.object({
  message: z.string().trim().min(1).max(CHAT_MAX_MESSAGE_CHARS),
  threadId: z.string().min(1).max(64).optional(),
});
