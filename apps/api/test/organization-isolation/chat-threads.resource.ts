import { defineResource, type IsolationResource } from "@soonwhy/test-support";
import { eq } from "drizzle-orm";
import { db } from "../../src/common/db";
import { chatMessages } from "../../src/common/db/schema";
import { chatThreadsRepository } from "./services";
import type { TestOrganization } from "./types";

type Ref = { threadId: string; projectId: string; userId: string };

const SEEDED_MESSAGE = "why is checkout slow";

const scopeOf = (organization: TestOrganization, projectId: string) => ({ orgId: organization.organization.id, projectId, userId: organization.userId });
const asActor = (actor: TestOrganization, ref: Ref) => [
  { ...scopeOf(actor, ref.projectId), userId: ref.userId },
  { ...scopeOf(actor, actor.project.id), userId: ref.userId },
];

const resource: IsolationResource<TestOrganization, Ref> = {
  name: "investigation chat messages",
  seed: async (victim) => {
    const scope = scopeOf(victim, victim.project.id);
    const threadId = await chatThreadsRepository.createThread(scope, "checkout");
    await chatThreadsRepository.addMessage(scope, { threadId, role: "user", content: SEEDED_MESSAGE });
    return { threadId, projectId: victim.project.id, userId: victim.userId };
  },
  intact: async (ref) => {
    const rows = await db.select().from(chatMessages).where(eq(chatMessages.threadId, ref.threadId));
    return rows.length === 1 && rows[0]?.content === SEEDED_MESSAGE;
  },
  cases: {
    list: {
      attempts: ({ actor, ref }) => ({
        "list messages with the actor's organization": async () => (await Promise.all(asActor(actor, ref).map((scope) => chatThreadsRepository.listMessages(scope, ref.threadId, 100)))).flat(),
        "read recent messages with the actor's organization": async () => (await Promise.all(asActor(actor, ref).map((scope) => chatThreadsRepository.recentMessages(scope, ref.threadId, 100)))).flat(),
      }),
      owner: ({ owner, ref }) => chatThreadsRepository.listMessages(scopeOf(owner, ref.projectId), ref.threadId, 100),
    },
    read: {
      attempts: ({ actor, ref }) => ({
        "the thread with the actor's organization": async () => (await Promise.all(asActor(actor, ref).map((scope) => chatThreadsRepository.getThread(scope, ref.threadId)))).filter(Boolean),
      }),
      owner: ({ owner, ref }) => chatThreadsRepository.getThread(scopeOf(owner, ref.projectId), ref.threadId),
    },
    create: {
      attempts: ({ actor, ref }) => ({
        "append a message to the other organization's thread": () =>
          Promise.all(asActor(actor, ref).map((scope) => chatThreadsRepository.addMessage(scope, { threadId: ref.threadId, role: "user", content: "injected" }))),
      }),
      owner: async ({ owner, ref }) => {
        await chatThreadsRepository.addMessage(scopeOf(owner, ref.projectId), { threadId: ref.threadId, role: "user", content: "follow up" });
        return [ref.threadId];
      },
    },
  },
};

export const chatThreadResource = defineResource(resource);
