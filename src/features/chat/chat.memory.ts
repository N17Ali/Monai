import type { UIMessage } from "ai";
import { nextChatWindow, type ChatStorage, type ConversationRecord } from "./chat.storage";

// In-memory adapter behind the chat persistence seam, used by the Vite dev
// server and the storage conformance test. Conversation numbering mirrors the
// D1 adapter: `listConversations` recreates the default when none remain, while
// `createConversation` numbers from the current maximum.
export function createMemoryChatStorage(userId: string): ChatStorage {
  let conversations: ConversationRecord[] = [];
  const histories = new Map<string, UIMessage[]>();
  const key = (conversationId: string) => `${userId}:${conversationId}`;

  function ensureDefault() {
    if (conversations.length === 0) conversations = [{ id: "conversation-1", number: 1 }];
  }

  return {
    listMessages: async (conversationId) => histories.get(key(conversationId)) ?? [],
    saveMessages: async (conversationId, messages, window) => {
      const stored = histories.get(key(conversationId)) ?? [];
      const { kept, added } = nextChatWindow(stored, messages, window);
      histories.set(key(conversationId), [...kept, ...added]);
    },
    listConversations: async () => {
      ensureDefault();
      return [...conversations];
    },
    createConversation: async () => {
      const number = conversations.reduce((max, conversation) => Math.max(max, conversation.number), 0) + 1;
      const record = { id: crypto.randomUUID(), number };
      conversations = [...conversations, record];
      return record;
    },
    removeConversation: async (id) => {
      conversations = conversations.filter((conversation) => conversation.id !== id);
      histories.delete(key(id));
    },
  };
}
