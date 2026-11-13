import { generateId } from "../generate-id";
import {
  index,
  pgTable,
  text,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type UploadKind = "user_avatar" | "member_avatar" | "organization_logo";
export type UploadStatus = "PENDING" | "READY" | "FAILED";

export const uploads = pgTable(
  "uploads",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    kind: text("kind").notNull().$type<UploadKind>(),
    organizationId: text("organization_id"),
    targetId: text("target_id").notNull(),
    key: text("key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes"),
    status: text("status").notNull().$type<UploadStatus>().default("PENDING"),
    uploadExpiresAt: timestamp("upload_expires_at"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uploads_key_idx").on(table.key),
    index("uploads_kind_target_idx").on(table.kind, table.targetId),
  ],
);
