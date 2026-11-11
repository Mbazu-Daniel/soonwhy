import { generateId } from "../generate-id";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export type LlmCredentialSource = "byok" | "platform";

export const aiProviderCredentials = pgTable(
  "ai_provider_credentials",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    orgId: text("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    baseUrl: text("base_url"),
    encryptedApiKey: text("encrypted_api_key").notNull(),
    keyHint: text("key_hint").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    verifiedAt: timestamp("verified_at"),
    lastErrorCode: text("last_error_code"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    orgUnique: uniqueIndex("ai_provider_credentials_org_unique").on(
      table.orgId,
    ),
  }),
);
