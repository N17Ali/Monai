// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { CHAT_HISTORY_LIMIT } from "../shared/contracts/ai";
import type { Transaction } from "../shared/contracts/transaction";
import { createApp } from "../src/app";
import { createMemoryStorage } from "../src/infrastructure/storage.memory";

type ModelCall = { prompt: Array<{ role: string; content: unknown }> };
type MockModel = { doStreamCalls: ModelCall[] };

const state = { models: [] as MockModel[] };

function mockModel(): MockModel {
  const model = new MockLanguageModelV4({
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
  }) as unknown as MockModel;
  state.models.push(model);
  return model;
}

function app(transactions: Transaction[] = [], aiApiKey: string | undefined = "test-key") {
  return createApp({
    storage: createMemoryStorage("test-user", transactions),
    config: { aiApiKey, chatHistoryLimit: CHAT_HISTORY_LIMIT, createChatModel: () => mockModel() },
  });
}

function userMessage(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function post(body: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } };
}

function call(handler: (request: Request) => Promise<Response>, path: string, init?: RequestInit) {
  return handler(new Request(new URL(path, "http://localhost"), init));
}

// Reading the stream is what fires the chat route's `onEnd` persistence hook.
async function send(handler: (request: Request) => Promise<Response>, body: unknown) {
  const response = await call(handler, "/api/chat", post(body));
  return { response, text: await response.text() };
}

function transaction(occurredAt: string): Transaction {
  return { id: "t1", source: "manual", status: "verified", kind: "expense", amountRial: 1000, occurredAt, sourceDateText: null, dateWasInferred: false, bankId: null, accountId: null, balanceAfterRial: null, bankDescription: null, userNote: "خرید", categoryId: null, originalMessage: null };
}

describe("chat api", () => {
  it("saves streamed turns and serves them back on the history endpoint", async () => {
    const handler = app();
    expect(await (await call(handler, "/api/chat/messages")).json()).toEqual({ messages: [] });

    const stream = await send(handler, { messages: [userMessage("u1", "سلام")] });
    expect(stream.response.status).toBe(200);
    expect(stream.response.headers.get("content-type")).toContain("text/event-stream");
    expect(stream.text).toContain("text-delta");
    expect(stream.text).toContain("پاسخ");

    const saved = (await (await call(handler, "/api/chat/messages")).json() as { messages: UIMessage[] }).messages;
    expect(saved.map((item) => item.role)).toEqual(["user", "assistant"]);
    expect(saved[1]?.parts).toEqual([{ type: "step-start" }, { type: "text", text: "پاسخ", state: "done" }]);

    const second = await send(handler, { messages: [...saved, userMessage("u2", "دوباره")] });
    expect(second.response.status).toBe(200);
    const grown = (await (await call(handler, "/api/chat/messages")).json() as { messages: UIMessage[] }).messages;
    expect(grown.map((item) => item.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(grown[1]?.id).toBe(saved[1]?.id);
  });

  it("serves only the most recent window once the history grows past the limit", async () => {
    const handler = app();
    let saved: UIMessage[] = [];
    for (let turn = 0; turn < 30; turn += 1) {
      await send(handler, { messages: [...saved, userMessage(`keep-u${turn}`, `سؤال ${turn}`)] });
      saved = (await (await call(handler, "/api/chat/messages")).json() as { messages: UIMessage[] }).messages;
    }
    expect(saved).toHaveLength(CHAT_HISTORY_LIMIT);
    expect(saved.filter((item) => item.id.startsWith("keep-")).map((item) => item.id)).toEqual(Array.from({ length: 25 }, (_, turn) => `keep-u${turn + 5}`));
    expect(saved.at(-1)?.role).toBe("assistant");
  });

  it("rejects the chat endpoint without an API key", async () => {
    const response = await call(app([], ""), "/api/chat", post({ messages: [userMessage("u1", "سلام")] }));
    expect(response.status).toBe(503);
  });

  it("rejects an invalid chat body with 400", async () => {
    const response = await call(app(), "/api/chat", post({ messages: "not-an-array" }));
    expect(response.status).toBe(400);
  });

  it("sends Tehran-local Jalali dates to the model instead of raw UTC", async () => {
    const handler = app([transaction("2026-09-03T22:22:00.000Z")]);
    const { response } = await send(handler, { messages: [userMessage("u1", "چه روزی بود؟")] });
    expect(response.status).toBe(200);
    const systemMessage = state.models.at(-1)?.doStreamCalls.flatMap((entry) => entry.prompt).find((entry) => entry.role === "system");
    const content = String(systemMessage?.content ?? "");
    expect(content).toContain("1405/06/13 01:52");
    expect(content).not.toContain("2026-09-03T22:22:00.000Z");
  });
});

describe("chat conversations", () => {
  it("lists, creates, and removes conversations with stable server numbering", async () => {
    const handler = app();
    expect(await (await call(handler, "/api/chat/conversations")).json()).toEqual({ conversations: [{ id: "conversation-1", number: 1 }] });

    const created = await call(handler, "/api/chat/conversations", { method: "POST" });
    expect(created.status).toBe(201);
    const second = (await created.json() as { conversation: { id: string; number: number } }).conversation;
    expect(second.number).toBe(2);

    const createdAgain = await call(handler, "/api/chat/conversations", { method: "POST" });
    expect((await createdAgain.json() as { conversation: { number: number } }).conversation.number).toBe(3);

    await call(handler, `/api/chat/conversations/${second.id}`, { method: "DELETE" });
    const listed = (await (await call(handler, "/api/chat/conversations")).json() as { conversations: Array<{ number: number }> }).conversations;
    expect(listed.map((item) => item.number)).toEqual([1, 3]);
  });

  it("drops the conversation history when its tab is closed and recreates a fresh default", async () => {
    const handler = app();
    await send(handler, { conversationId: "conversation-1", messages: [userMessage("u1", "سلام")] });
    const before = (await (await call(handler, "/api/chat/messages")).json() as { messages: UIMessage[] }).messages;
    expect(before.some((item) => item.id === "u1")).toBe(true);

    await call(handler, "/api/chat/conversations/conversation-1", { method: "DELETE" });
    expect(await (await call(handler, "/api/chat/conversations")).json()).toEqual({ conversations: [{ id: "conversation-1", number: 1 }] });
    expect(await (await call(handler, "/api/chat/messages")).json()).toEqual({ messages: [] });
  });
});
