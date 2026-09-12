import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";

vi.mock("../src/features/chat/model", async () => {
  const { MockLanguageModelV4, simulateReadableStream } = await import("ai/test");
  return {
    createChatModel: () =>
      new MockLanguageModelV4({
        doStream: {
          stream: simulateReadableStream({
            chunks: [
              { type: "text-start", id: "p1" },
              { type: "text-delta", id: "p1", delta: "پاسخ" },
              { type: "text-end", id: "p1" },
              { type: "finish", usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } }, finishReason: "stop" },
            ],
          }),
        },
      }),
  };
});

async function createHandler() {
  vi.resetModules();
  const { devApi: freshDevApi } = await import("../scripts/dev-api");
  let handler: ((request: IncomingMessage, response: ServerResponse, next: () => void) => Promise<void> | void) | undefined;
  freshDevApi({ aiApiKey: "test-key" }).configureServer({
    middlewares: { use: (fn: typeof handler) => { handler = fn; } },
  } as never);
  if (!handler) throw new Error("middleware was not registered");
  return (request: IncomingMessage, response: ServerResponse) => handler!(request, response, () => {});
}

function fakeRequest(url: string, method: string, body?: unknown): IncomingMessage {
  const chunks = body === undefined ? [] : [JSON.stringify(body)];
  return {
    url,
    method,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  } as unknown as IncomingMessage;
}

function fakeResponse() {
  const chunks: Buffer[] = [];
  const headers: Record<string, string> = {};
  const state = { statusCode: 200, ended: false };
  const response = {
    get statusCode() {
      return state.statusCode;
    },
    set statusCode(value: number) {
      state.statusCode = value;
    },
    setHeader: (key: string, value: string) => {
      headers[key.toLowerCase()] = value;
    },
    write: (chunk: Buffer) => {
      chunks.push(Buffer.from(chunk));
    },
    end: (chunk?: Buffer) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      state.ended = true;
    },
  } as unknown as ServerResponse;
  return {
    response,
    status: () => state.statusCode,
    body: () => Buffer.concat(chunks).toString("utf8"),
    headers,
  };
}

describe("dev api enrichment date editing", () => {
  it("persists an edited occurredAt when a draft is verified", async () => {
    const handle = await createHandler();

    const imported = fakeResponse();
    await handle(fakeRequest("/api/imports/clipboard", "POST", { text: "بلو 418,000 ریال از حساب شما پرید." }), imported.response);
    const draftId = JSON.parse(imported.body()).id;

    const drafts = fakeResponse();
    await handle(fakeRequest("/api/enrichment", "GET"), drafts.response);
    const draft = JSON.parse(drafts.body()).drafts.find((item: { id: string }) => item.id === draftId);
    expect(draft).toBeDefined();

    const editedDate = "2024-05-22T20:30:00.000Z";
    const verified = fakeResponse();
    await handle(fakeRequest(`/api/enrichment/${draftId}`, "POST", { kind: "expense", amountToman: 41800, note: "خرید", occurredAt: editedDate }), verified.response);
    expect(verified.status()).toBe(200);

    const transactions = fakeResponse();
    await handle(fakeRequest("/api/transactions", "GET"), transactions.response);
    const saved = JSON.parse(transactions.body()).transactions.find((item: { id: string }) => item.id === draftId);
    expect(saved?.occurredAt).toBe(editedDate);
    expect(saved?.status).toBe("verified");
  });
});
