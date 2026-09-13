import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { UIMessage } from "ai";
import type { Database } from "../../infrastructure/db/client";
import { chatMessages, conversations } from "../../infrastructure/db/schema";
import { chatWindowPlan, type ChatStorage } from "./chat.storage";

// D1 allows at most 100 bound parameters per statement. Each chat-message
// insert binds 6 values per row (id, user_id, conversation_id, role, parts,
// created_at), so at most 16 rows fit in a single statement (96 params), and
// each stale-id delete binds 2 scope values plus one id per row (98 ids max).
// Both paths are chunked, so CHAT_HISTORY_LIMIT is a product decision
// (token cost per turn), not a D1 constraint.
const D1_MAX_BOUND_PARAMS = 100;
const CHAT_MESSAGE_COLUMNS = 6;
const MAX_ROWS_PER_INSERT = Math.floor(D1_MAX_BOUND_PARAMS / CHAT_MESSAGE_COLUMNS);
const MAX_IDS_PER_DELETE = D1_MAX_BOUND_PARAMS - 2;

function toMessage(row: { id: string; role: string; parts: string }) {
  return { id: row.id, role: row.role as UIMessage["role"], parts: JSON.parse(row.parts) } as UIMessage;
}

// D1 adapter behind the chat persistence seam. Identity is closed over here so
// no chat module imports the transaction repository for a user id.
export function createD1ChatStorage(db: Database, userId: string): ChatStorage {
  return {
    listMessages: async (conversationId) =>
      (
        await db
          .select()
          .from(chatMessages)
          .where(and(eq(chatMessages.userId, userId), eq(chatMessages.conversationId, conversationId)))
          .orderBy(asc(chatMessages.createdAt), sql`rowid`)
      ).map(toMessage),
    saveMessages: async (conversationId, messages, window) => {
      if (messages.length === 0) return;
      const storedIds = (await db.select({ id: chatMessages.id }).from(chatMessages).where(and(eq(chatMessages.userId, userId), eq(chatMessages.conversationId, conversationId)))).map((row) => row.id);
      const plan = chatWindowPlan(storedIds, messages, window);
      const rows = plan.recent
        .filter((message) => !plan.storedIds.has(message.id))
        .map((message) => ({
          id: message.id,
          userId,
          conversationId,
          role: message.role,
          parts: JSON.stringify(message.parts),
          createdAt: new Date().toISOString(),
        }));
      const chunks: (typeof rows)[] = [];
      for (let start = 0; start < rows.length; start += MAX_ROWS_PER_INSERT) {
        chunks.push(rows.slice(start, start + MAX_ROWS_PER_INSERT));
      }
      if (chunks.length > 0) {
        const insertStatements = chunks.map((chunk) =>
          db.insert(chatMessages).values(chunk).onConflictDoNothing({ target: [chatMessages.userId, chatMessages.id] }),
        ) as unknown as Parameters<typeof db.batch>[0];
        await db.batch(insertStatements);
      }
      for (let start = 0; start < plan.staleIds.length; start += MAX_IDS_PER_DELETE) {
        await db
          .delete(chatMessages)
          .where(and(eq(chatMessages.userId, userId), eq(chatMessages.conversationId, conversationId), inArray(chatMessages.id, plan.staleIds.slice(start, start + MAX_IDS_PER_DELETE))));
      }
    },
    listConversations: async () => {
      let rows = await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(asc(conversations.number));
      if (rows.length === 0) {
        await db.insert(conversations).values({ id: "conversation-1", userId, number: 1, createdAt: new Date().toISOString() });
        rows = await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(asc(conversations.number));
      }
      return rows.map((row) => ({ id: row.id, number: row.number }));
    },
    createConversation: async () => {
      const rows = await db.select({ number: conversations.number }).from(conversations).where(eq(conversations.userId, userId));
      const number = rows.reduce((max, row) => Math.max(max, row.number), 0) + 1;
      const id = crypto.randomUUID();
      await db.insert(conversations).values({ id, userId, number, createdAt: new Date().toISOString() });
      return { id, number };
    },
    removeConversation: async (id) => {
      await db.delete(conversations).where(and(eq(conversations.userId, userId), eq(conversations.id, id)));
      await db.delete(chatMessages).where(and(eq(chatMessages.userId, userId), eq(chatMessages.conversationId, id)));
    },
  };
}
