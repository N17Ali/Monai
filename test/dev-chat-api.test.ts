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

const { devApi } = await import("../scripts/dev-api");

type NextHandler = (request: IncomingMessage, response: ServerResponse, next: () => void) => Promise<void> | void;

function createHandler() {
  let handler: NextHandler | undefined;
  devApi({ aiApiKey: "test-key" }).configureServer({
    middlewares: { use: (fn: NextHandler) => { handler = fn; } },
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

async function createIsolatedHandler() {
  vi.resetModules();
  const { devApi: freshDevApi } = await import("../scripts/dev-api");
  let handler: NextHandler | undefined;
  freshDevApi({ aiApiKey: "test-key" }).configureServer({
    middlewares: { use: (fn: NextHandler) => { handler = fn; } },
  } as never);
  if (!handler) throw new Error("middleware was not registered");
  return (request: IncomingMessage, response: ServerResponse) => handler!(request, response, () => {});
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
    isEnded: () => state.ended,
  };
}

const userMessage = { id: "u1", role: "user", parts: [{ type: "text", text: "سلام" }] };

describe("dev api chat persistence", () => {
  it("saves streamed turns and serves them back on the history endpoint", async () => {
    const handle = createHandler();

    const empty = fakeResponse();
    await handle(fakeRequest("/api/chat/messages", "GET"), empty.response);
    expect(empty.status()).toBe(200);
    expect(JSON.parse(empty.body())).toEqual({ messages: [] });

    const stream = fakeResponse();
    await handle(fakeRequest("/api/chat", "POST", { messages: [userMessage] }), stream.response);
    expect(stream.status()).toBe(200);
    expect(stream.headers["content-type"]).toContain("text/event-stream");
    expect(stream.body()).toContain("text-delta");
    expect(stream.body()).toContain("پاسخ");

    const history = fakeResponse();
    await handle(fakeRequest("/api/chat/messages", "GET"), history.response);
    const saved = JSON.parse(history.body()).messages;
    expect(saved.map((message: { role: string }) => message.role)).toEqual(["user", "assistant"]);
    expect(saved[1].parts).toEqual([{ type: "step-start" }, { type: "text", text: "پاسخ", state: "done" }]);

    const secondTurn = fakeResponse();
    await handle(fakeRequest("/api/chat", "POST", { messages: [...saved, { id: "u2", role: "user", parts: [{ type: "text", text: "دوباره" }] }] }), secondTurn.response);
    const grown = fakeResponse();
    await handle(fakeRequest("/api/chat/messages", "GET"), grown.response);
    const savedAgain = JSON.parse(grown.body()).messages;
    expect(savedAgain.map((message: { role: string }) => message.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(savedAgain[1].id).toBe(saved[1].id);
  });

  it("serves only the most recent 50 messages once the history grows past the window", async () => {
    const handle = createHandler();

    let saved: { id: string; role: string }[] = [];
    for (let turn = 0; turn < 30; turn += 1) {
      const userMessage = { id: `keep-u${turn}`, role: "user", parts: [{ type: "text", text: `سؤال ${turn}` }] };
      const stream = fakeResponse();
      await handle(fakeRequest("/api/chat", "POST", { messages: [...saved, userMessage] as unknown[] }), stream.response);
      const history = fakeResponse();
      await handle(fakeRequest("/api/chat/messages", "GET"), history.response);
      saved = JSON.parse(history.body()).messages;
    }

    expect(saved).toHaveLength(50);
    const own = saved.filter((message) => message.id.startsWith("keep-"));
    expect(own.map((message) => message.id)).toEqual(Array.from({ length: 25 }, (_, turn) => `keep-u${turn + 5}`));
    expect(saved.at(-1)?.role).toBe("assistant");
    expect(saved.at(-2)?.id).toBe("keep-u29");
  });

  it("rejects the chat endpoint when no API key is configured", async () => {
    let handler: NextHandler | undefined;
    devApi({}).configureServer({ middlewares: { use: (fn: NextHandler) => { handler = fn; } } } as never);
    const response = fakeResponse();
    await handler!(fakeRequest("/api/chat", "POST", { messages: [userMessage] }), response.response);
    expect(response.status()).toBe(503);
  });
});

describe("dev api conversations", () => {
  it("lists, creates, and removes conversations with stable server-side numbering", async () => {
    const handle = await createIsolatedHandler();

    const initial = fakeResponse();
    await handle(fakeRequest("/api/chat/conversations", "GET"), initial.response);
    expect(initial.status()).toBe(200);
    expect(JSON.parse(initial.body())).toEqual({ conversations: [{ id: "conversation-1", number: 1 }] });

    const created = fakeResponse();
    await handle(fakeRequest("/api/chat/conversations", "POST"), created.response);
    expect(created.status()).toBe(201);
    expect(JSON.parse(created.body()).conversation.number).toBe(2);

    const createdAgain = fakeResponse();
    await handle(fakeRequest("/api/chat/conversations", "POST"), createdAgain.response);
    expect(JSON.parse(createdAgain.body()).conversation.number).toBe(3);

    const list = fakeResponse();
    await handle(fakeRequest("/api/chat/conversations", "GET"), list.response);
    expect(JSON.parse(list.body()).conversations.map((conversation: { number: number }) => conversation.number)).toEqual([1, 2, 3]);

    const secondId = JSON.parse(created.body()).conversation.id;
    const removed = fakeResponse();
    await handle(fakeRequest(`/api/chat/conversations/${secondId}`, "DELETE"), removed.response);
    expect(removed.status()).toBe(200);

    const afterRemove = fakeResponse();
    await handle(fakeRequest("/api/chat/conversations", "GET"), afterRemove.response);
    expect(JSON.parse(afterRemove.body()).conversations.map((conversation: { number: number }) => conversation.number)).toEqual([1, 3]);

    const createdAfterRemove = fakeResponse();
    await handle(fakeRequest("/api/chat/conversations", "POST"), createdAfterRemove.response);
    expect(JSON.parse(createdAfterRemove.body()).conversation.number).toBe(4);
  });

  it("drops the conversation history when its tab is closed and recreates a fresh default", async () => {
    const handle = await createIsolatedHandler();

    const stream = fakeResponse();
    await handle(fakeRequest("/api/chat", "POST", { conversationId: "conversation-1", messages: [userMessage] }), stream.response);
    expect(stream.status()).toBe(200);
    const history = fakeResponse();
    await handle(fakeRequest("/api/chat/messages", "GET"), history.response);
    expect(JSON.parse(history.body()).messages.some((message: { id: string }) => message.id === "u1")).toBe(true);

    const removed = fakeResponse();
    await handle(fakeRequest("/api/chat/conversations/conversation-1", "DELETE"), removed.response);
    expect(removed.status()).toBe(200);

    const afterClose = fakeResponse();
    await handle(fakeRequest("/api/chat/conversations", "GET"), afterClose.response);
    expect(JSON.parse(afterClose.body())).toEqual({ conversations: [{ id: "conversation-1", number: 1 }] });

    const historyAfter = fakeResponse();
    await handle(fakeRequest("/api/chat/messages", "GET"), historyAfter.response);
    expect(JSON.parse(historyAfter.body()).messages).toEqual([]);
  });
});
