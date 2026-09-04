import { queryOptions } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { chatHistoryResponseSchema } from "@shared/contracts/ai";
import { api } from "@/shared/api/client";

export const chatKeys = { history: ["chat", "history"] as const };

export const chatHistoryQuery = queryOptions({
  queryKey: chatKeys.history,
  queryFn: async () => {
    const payload = chatHistoryResponseSchema.parse(await api<unknown>("/api/chat/messages"));
    return { messages: payload.messages as unknown as UIMessage[] };
  },
});
