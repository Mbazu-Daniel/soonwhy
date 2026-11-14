import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { generateId } from "../generate-id";
import { users } from "./auth";
import { organizations } from "./organizations";
import { projects } from "./projects";

export type ChatMessageRole = "user" | "assistant";
export type ChatMessageStatus = "complete" | "failed" | "cancelled";

export interface ChatMessageStep {
  id: string;
  tool: string;
  status: "running" | "complete" | "failed";
  detail?: string;
}

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: text("id").primaryKey().$defaultFn(() => generateId()),
    orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_threads_owner_updated_idx").on(table.orgId, table.projectId, table.createdBy, table.updatedAt),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => generateId()),
    threadId: text("thread_id").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
    role: text("role").$type<ChatMessageRole>().notNull(),
    content: text("content").notNull().default(""),
    steps: jsonb("steps").$type<ChatMessageStep[]>().notNull().default([]),
    status: text("status").$type<ChatMessageStatus>().notNull().default("complete"),
    totalTokens: integer("total_tokens").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("chat_messages_thread_created_idx").on(table.threadId, table.createdAt)],
);
