import { convertToModelMessages, generateId, streamText, type UIMessage } from "ai";
import { chatRequestSchema, AI_PUBLIC_ERROR } from "../../../shared/contracts/ai";
import type { Transaction } from "../../../shared/contracts/transaction";
import { summarizeBalances, withLegacyBalances } from "../../../shared/parsing/balance";
import type { ChatStorage } from "./chat.storage";
import { buildSystemPrompt } from "./system-prompt";

export type ChatModelFactory = (apiKey: string) => Parameters<typeof streamText>[0]["model"];

export type ChatConfig = {
  aiApiKey?: string;
  chatHistoryLimit: number;
  createChatModel: ChatModelFactory;
};

// Chat application module: request handling and the model boundary live behind
// this interface. The storage port is injected so D1 and in-memory share it.
export function createChatRoutes(options: { chat: ChatStorage; config: ChatConfig; loadVerifiedTransactions: () => Promise<Transaction[]> }) {
  const { chat, config, loadVerifiedTransactions } = options;
  return async function chatRoutes(request: Request, path: string): Promise<Response | null> {
    if (path === "/api/chat/conversations" && request.method === "GET") {
      return Response.json({ conversations: await chat.listConversations() });
    }
    if (path === "/api/chat/conversations" && request.method === "POST") {
      return Response.json({ conversation: await chat.createConversation() }, { status: 201 });
    }
    const conversationMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)$/);
    if (conversationMatch && request.method === "DELETE") {
      await chat.removeConversation(decodeURIComponent(conversationMatch[1]));
      return Response.json({ status: "removed" });
    }
    if (path === "/api/chat/messages" && request.method === "GET") {
      const conversationId = new URL(request.url).searchParams.get("conversationId") ?? "conversation-1";
      return Response.json({ messages: await chat.listMessages(conversationId) });
    }
    if (path !== "/api/chat" || request.method !== "POST") return null;
    if (!config.aiApiKey) return Response.json({ error: "سرویس هوش مصنوعی پیکربندی نشده است" }, { status: 503 });
    const { conversationId, messages } = chatRequestSchema.parse(await request.json());
    const transactions = await loadVerifiedTransactions();
    const balances = summarizeBalances(withLegacyBalances(transactions));
    const result = streamText({
      model: config.createChatModel(config.aiApiKey),
      system: buildSystemPrompt(transactions, balances),
      messages: await convertToModelMessages(messages as UIMessage[]),
    });
    return result.toUIMessageStreamResponse({
      generateMessageId: generateId,
      originalMessages: messages as UIMessage[],
      onError: () => AI_PUBLIC_ERROR,
      onEnd: async ({ messages: finalMessages }) => {
        await chat.saveMessages(conversationId, finalMessages, config.chatHistoryLimit);
      },
    });
  };
}
