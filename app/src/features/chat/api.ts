import { queryOptions } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { chatHistoryResponseSchema, conversationCreateResponseSchema, conversationListResponseSchema } from "@shared/contracts/ai";
import { api } from "@/shared/api/client";

export const chatKeys = {
  all: ["chat"] as const,
  conversations: ["chat", "conversations"] as const,
  history: (conversationId: string) => ["chat", "history", conversationId] as const,
};

export const conversationsQuery = queryOptions({
  queryKey: chatKeys.conversations,
  queryFn: async () => conversationListResponseSchema.parse(await api<unknown>("/api/chat/conversations")),
});

export function chatHistoryQuery(conversationId: string) {
  return queryOptions({
    queryKey: chatKeys.history(conversationId),
    queryFn: async () => {
      const path = conversationId === "conversation-1" ? "/api/chat/messages" : `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`;
      const payload = chatHistoryResponseSchema.parse(await api<unknown>(path));
      return { messages: payload.messages as unknown as UIMessage[] };
    },
  });
}

export async function createConversation() {
  return conversationCreateResponseSchema.parse(await api<unknown>("/api/chat/conversations", { method: "POST" })).conversation;
}

export async function removeConversation(id: string) {
  await api<unknown>(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
}
