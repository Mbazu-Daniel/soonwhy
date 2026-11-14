import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../../../../common/db";
import { chatMessages, chatThreads } from "../../../../common/db/schema";
import type { ChatMessageRole, ChatMessageStatus, ChatMessageStep } from "../../../../common/db/schema";

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

function owned(scope: ThreadScope, threadId: string) {
  return and(
    eq(chatThreads.id, threadId),
    eq(chatThreads.orgId, scope.orgId),
    eq(chatThreads.projectId, scope.projectId),
    eq(chatThreads.createdBy, scope.userId),
  );
}

@Injectable()
export class ChatThreadsRepository {
  async createThread(scope: ThreadScope, title: string): Promise<string> {
    const [row] = await db
      .insert(chatThreads)
      .values({ orgId: scope.orgId, projectId: scope.projectId, createdBy: scope.userId, title })
      .returning({ id: chatThreads.id });
    return row!.id;
  }

  async getThread(scope: ThreadScope, threadId: string) {
    const [row] = await db.select().from(chatThreads).where(owned(scope, threadId)).limit(1);
    return row;
  }

  listThreads(scope: ThreadScope, limit: number) {
    return db
      .select({ id: chatThreads.id, title: chatThreads.title, updatedAt: chatThreads.updatedAt })
      .from(chatThreads)
      .where(
        and(
          eq(chatThreads.orgId, scope.orgId),
          eq(chatThreads.projectId, scope.projectId),
          eq(chatThreads.createdBy, scope.userId),
        ),
      )
      .orderBy(desc(chatThreads.updatedAt))
      .limit(limit);
  }

  listMessages(threadId: string, limit: number) {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit);
  }

  async recentMessages(threadId: string, limit: number) {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  async addMessage(message: NewChatMessage): Promise<void> {
    await db.insert(chatMessages).values({
      threadId: message.threadId,
      role: message.role,
      content: message.content,
      steps: message.steps ?? [],
      status: message.status ?? "complete",
      totalTokens: message.totalTokens ?? 0,
    });
    await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, message.threadId));
  }

  async deleteThread(scope: ThreadScope, threadId: string): Promise<boolean> {
    const removed = await db.delete(chatThreads).where(owned(scope, threadId)).returning({ id: chatThreads.id });
    return removed.length > 0;
  }
}
