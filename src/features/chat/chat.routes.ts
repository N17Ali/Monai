import { convertToModelMessages, generateId, streamText, type UIMessage } from "ai";
import { chatRequestSchema, AI_PUBLIC_ERROR } from "../../../shared/contracts/ai";
import type { Database } from "../../infrastructure/db/client";
import { chatRepository } from "./chat.repository";
import { transactionRepository } from "../transactions/transaction.repository";
import { summarizeBalances, withLegacyBalances } from "../../../shared/parsing/balance";
import { createChatModel } from "./model";
import { buildSystemPrompt } from "./system-prompt";

export async function chatRoutes(request: Request, path: string, db: Database, env: Env) {
  if (path === "/api/chat/conversations" && request.method === "GET") {
    return Response.json({ conversations: await chatRepository(db).listConversations() });
  }
  if (path === "/api/chat/conversations" && request.method === "POST") {
    return Response.json({ conversation: await chatRepository(db).createConversation() }, { status: 201 });
  }
  const conversationMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)$/);
  if (conversationMatch && request.method === "DELETE") {
    await chatRepository(db).removeConversation(conversationMatch[1]);
    return Response.json({ status: "removed" });
  }
  if (path === "/api/chat/messages" && request.method === "GET") {
    const conversationId = new URL(request.url).searchParams.get("conversationId") ?? "conversation-1";
    return Response.json({ messages: await chatRepository(db).list(conversationId) });
  }
  if (path !== "/api/chat" || request.method !== "POST") return null;
  if (!env.GOOGLE_API_KEY) return Response.json({ error: "سرویس هوش مصنوعی پیکربندی نشده است" }, { status: 503 });
  const { conversationId, messages } = chatRequestSchema.parse(await request.json());
  const transactions = await transactionRepository(db).listVerified();
  const balances = summarizeBalances(withLegacyBalances(transactions));
  const result = streamText({
    model: createChatModel(env.GOOGLE_API_KEY),
    system: buildSystemPrompt(transactions, balances),
    messages: await convertToModelMessages(messages as UIMessage[]),
  });
  return result.toUIMessageStreamResponse({
    generateMessageId: generateId,
    originalMessages: messages as UIMessage[],
    onError: () => AI_PUBLIC_ERROR,
    onEnd: async ({ messages: finalMessages }) => {
      await chatRepository(db).save(finalMessages, conversationId);
    },
  });
}
