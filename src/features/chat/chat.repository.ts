import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import type { UIMessage } from "ai";
import { CHAT_HISTORY_LIMIT } from "../../../shared/contracts/ai";
import type { Database } from "../../infrastructure/db/client";
import { chatMessages } from "../../infrastructure/db/schema";
import { USER_ID } from "../transactions/transaction.repository";

function toMessage(row: { id: string; role: string; parts: string }) {
  return { id: row.id, role: row.role as UIMessage["role"], parts: JSON.parse(row.parts) } as UIMessage;
}

export function chatRepository(db: Database) {
  return {
    list: async () =>
      (
        await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.userId, USER_ID))
          .orderBy(asc(chatMessages.createdAt), sql`rowid`)
      ).map(toMessage),
    save: async (messages: UIMessage[]) => {
      if (messages.length === 0) return;
      const recent = messages.slice(-CHAT_HISTORY_LIMIT);
      await db
        .insert(chatMessages)
        .values(
          recent.map((message) => ({
            id: message.id,
            userId: USER_ID,
            role: message.role,
            parts: JSON.stringify(message.parts),
            createdAt: new Date().toISOString(),
          })),
        )
        .onConflictDoUpdate({
          target: [chatMessages.userId, chatMessages.id],
          set: { role: sql`excluded.role`, parts: sql`excluded.parts` },
        });
      await db
        .delete(chatMessages)
        .where(and(eq(chatMessages.userId, USER_ID), notInArray(chatMessages.id, recent.map((message) => message.id))));
    },
  };
}
