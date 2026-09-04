import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { convertToModelMessages, generateId, streamText, type UIMessage } from "ai";
import { AI_PUBLIC_ERROR } from "../shared/contracts/ai";
import { clipboardImportSchema, enrichmentUpdateSchema, manualTransactionSchema, type Transaction } from "../shared/contracts/transaction";
import { containsSensitiveCode, parseSms } from "../shared/parsing/sms";
import { createChatModel } from "../src/features/chat/model";
import { createChatHistoryStore } from "../src/features/chat/chat-store";
import { summarizeBalances, withLegacyBalances } from "../src/features/chat/balance-summary";
import { buildSystemPrompt } from "../src/features/chat/system-prompt";

const drafts: Transaction[] = [];
const verified: Transaction[] = [];
const chatStore = createChatHistoryStore();

async function readBody(request: IncomingMessage) {
  let value = "";
  for await (const chunk of request) value += chunk;
  return JSON.parse(value);
}

function send(response: ServerResponse, status: number, data: unknown) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(data));
}

async function pipeWebResponse(webResponse: Response, response: ServerResponse) {
  response.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => response.setHeader(key, value));
  if (!webResponse.body) return response.end();
  const reader = webResponse.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    response.write(Buffer.from(value));
  }
  response.end();
}

export function devApi(options: { aiApiKey?: string }): Plugin {
  return {
    name: "monai-dev-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith("/api/")) return next();
        const path = new URL(request.url, "http://localhost").pathname;
        try {
          if (path === "/api/health") return send(response, 200, { ok: true });
          if (path === "/api/enrichment" && request.method === "GET") return send(response, 200, { drafts, count: drafts.length });
          if (path === "/api/transactions" && request.method === "GET") return send(response, 200, { transactions: verified });
          if (path === "/api/imports/clipboard" && request.method === "POST") {
            const { text } = clipboardImportSchema.parse(await readBody(request));
            if (containsSensitiveCode(text)) return send(response, 200, { status: "sensitive_blocked" });
            if (drafts.some((draft) => draft.originalMessage === text)) return send(response, 200, { status: "duplicate" });
            const parsed = parseSms(text);
            const draft: Transaction = { id: crypto.randomUUID(), source: "clipboard", status: "needs_review", kind: parsed.kind, amountRial: parsed.amountRial, occurredAt: parsed.occurredAt ?? new Date().toISOString(), sourceDateText: parsed.sourceDateText, dateWasInferred: parsed.occurredAt == null, bankId: parsed.bankId, accountId: parsed.accountId, balanceAfterRial: parsed.balanceAfterRial, bankDescription: null, userNote: null, categoryId: null, originalMessage: text };
            drafts.unshift(draft);
            return send(response, 201, { status: "draft_created", id: draft.id });
          }
          if (path === "/api/transactions/manual" && request.method === "POST") {
            const input = manualTransactionSchema.parse(await readBody(request));
            const item: Transaction = { id: crypto.randomUUID(), source: "manual", status: "verified", kind: input.kind, amountRial: Math.round(input.amountToman * 10), occurredAt: new Date(input.occurredAt).toISOString(), sourceDateText: null, dateWasInferred: false, bankId: null, accountId: null, balanceAfterRial: null, bankDescription: null, userNote: input.note || null, categoryId: null, originalMessage: null };
            verified.unshift(item);
            return send(response, 201, { status: "verified", id: item.id });
          }
          const match = path.match(/^\/api\/enrichment\/([^/]+)$/);
          if (match && request.method === "POST") {
            const input = enrichmentUpdateSchema.parse(await readBody(request));
            const draft = drafts.find((item) => item.id === match[1]);
            if (!draft) return send(response, 404, { error: "پیش‌نویس پیدا نشد" });
            verified.unshift({ ...draft, status: "verified", kind: input.kind, amountRial: Math.round(input.amountToman * 10), userNote: input.note || null });
            drafts.splice(drafts.indexOf(draft), 1);
            return send(response, 200, { status: "verified" });
          }
          if (path === "/api/chat/messages" && request.method === "GET") return send(response, 200, { messages: chatStore.list() });
          if (path === "/api/chat" && request.method === "POST") {
            if (!options.aiApiKey) return send(response, 503, { error: "سرویس هوش مصنوعی پیکربندی نشده است" });
            const { messages } = await readBody(request) as { messages: UIMessage[] };
            const balances = summarizeBalances(withLegacyBalances(verified));
            const result = streamText({ model: createChatModel(options.aiApiKey), system: buildSystemPrompt(verified, balances), messages: await convertToModelMessages(messages) });
            return pipeWebResponse(result.toUIMessageStreamResponse({
              generateMessageId: generateId,
              originalMessages: messages,
              onError: () => AI_PUBLIC_ERROR,
              onEnd: ({ messages: finalMessages }) => chatStore.save(finalMessages),
            }), response);
          }
          return send(response, 404, { error: "مسیر پیدا نشد" });
        } catch {
          return send(response, 400, { error: "اطلاعات ارسالی معتبر نیست" });
        }
      });
    },
  };
}
