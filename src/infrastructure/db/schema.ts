import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull().default("needs_review"),
    kind: text("kind").notNull().default("unknown"),
    bankId: text("bank_id"),
    accountId: text("account_id"),
    amountRial: integer("amount_rial").notNull(),
    balanceAfterRial: integer("balance_after_rial"),
    occurredAt: text("occurred_at").notNull(),
    sourceDateText: text("source_date_text"),
    dateWasInferred: integer("date_was_inferred", { mode: "boolean" }).notNull().default(false),
    bankDescription: text("bank_description"),
    userNote: text("user_note"),
    categoryId: text("category_id"),
    originalMessage: text("original_message"),
    fingerprint: text("fingerprint"),
    extractionMeta: text("extraction_meta"),
    createdAt: text("created_at").notNull(),
    verifiedAt: text("verified_at"),
  },
  (table) => [
    index("idx_transactions_user_status").on(table.userId, table.status),
    index("idx_transactions_user_time").on(table.userId, table.occurredAt),
    uniqueIndex("idx_transactions_fingerprint").on(table.userId, table.fingerprint),
  ],
);

export type TransactionRow = typeof transactions.$inferSelect;

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").notNull(),
    userId: text("user_id").notNull(),
    conversationId: text("conversation_id").notNull().default("conversation-1"),
    role: text("role").notNull(),
    parts: text("parts").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index("idx_chat_messages_user_time").on(table.userId, table.createdAt),
  ],
);

export type ChatMessageRow = typeof chatMessages.$inferSelect;

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").notNull(),
    userId: text("user_id").notNull(),
    number: integer("number").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index("idx_conversations_user_number").on(table.userId, table.number),
  ],
);

export type ConversationRow = typeof conversations.$inferSelect;
