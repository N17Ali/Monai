import type { UIMessage } from "ai";
import { CHAT_HISTORY_LIMIT } from "../../../shared/contracts/ai";

export function mergeChatMessages(current: UIMessage[], incoming: UIMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()];
}

export function createChatHistoryStore() {
  const histories = new Map<string, UIMessage[]>();
  return {
    list: (conversationId = "conversation-1") => histories.get(conversationId) ?? [],
    save: (messages: UIMessage[], conversationId = "conversation-1") => {
      const history = histories.get(conversationId) ?? [];
      histories.set(conversationId, mergeChatMessages(history, messages).slice(-CHAT_HISTORY_LIMIT));
    },
    remove: (conversationId = "conversation-1") => {
      histories.delete(conversationId);
    },
  };
}
