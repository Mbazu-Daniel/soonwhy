import { Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../../../../../common/db";
import { chatMessages, chatThreads } from "../../../../../common/db/schema";
import type { ThreadScope, NewChatMessage } from "./chat-threads.repository.types";

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

  async listMessages(scope: ThreadScope, threadId: string, limit: number) {
    const rows = await db
      .select({ message: chatMessages })
      .from(chatMessages)
      .innerJoin(chatThreads, eq(chatThreads.id, chatMessages.threadId))
      .where(owned(scope, threadId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit);
    return rows.map((row) => row.message);
  }

  async recentMessages(scope: ThreadScope, threadId: string, limit: number) {
    const rows = await db
      .select({ message: chatMessages })
      .from(chatMessages)
      .innerJoin(chatThreads, eq(chatThreads.id, chatMessages.threadId))
      .where(owned(scope, threadId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return rows.map((row) => row.message).reverse();
  }

  async addMessage(scope: ThreadScope, message: NewChatMessage): Promise<void> {
    await db.transaction(async (tx) => {
      const touched = await tx
        .update(chatThreads)
        .set({ updatedAt: new Date() })
        .where(owned(scope, message.threadId))
        .returning({ id: chatThreads.id });
      if (touched.length === 0) throw new NotFoundException("Conversation not found");
      await tx.insert(chatMessages).values({
        threadId: message.threadId,
        role: message.role,
        content: message.content,
        steps: message.steps ?? [],
        status: message.status ?? "complete",
        totalTokens: message.totalTokens ?? 0,
      });
    });
  }

  async deleteThread(scope: ThreadScope, threadId: string): Promise<boolean> {
    const removed = await db.delete(chatThreads).where(owned(scope, threadId)).returning({ id: chatThreads.id });
    return removed.length > 0;
  }
}
