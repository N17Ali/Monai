import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";

type ModelPromptMessage = { role: string; content: unknown };
type MockModel = { doStreamCalls: Array<{ prompt: ModelPromptMessage[] }> };

const state = vi.hoisted(() => ({ models: [] as MockModel[] }));

vi.mock("../src/features/chat/model", async () => {
  const { MockLanguageModelV4, simulateReadableStream } = await import("ai/test");
  return {
    createChatModel: () => {
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
    },
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

function fakeResponse() {
  const state = { statusCode: 200, ended: false };
  const response = {
    get statusCode() {
      return state.statusCode;
    },
    set statusCode(value: number) {
      state.statusCode = value;
    },
    setHeader: () => {},
    write: () => {},
    end: () => {
      state.ended = true;
    },
  } as unknown as ServerResponse;
  return { response, status: () => state.statusCode, isEnded: () => state.ended };
}

const userMessage = { id: "u1", role: "user", parts: [{ type: "text", text: "چه روزی این تراکنش بود؟" }] };

describe("chat model date wiring", () => {
  it("sends Tehran-local Jalali dates to the model instead of raw UTC ISO strings", async () => {
    const handle = createHandler();

    const manual = fakeResponse();
    await handle(fakeRequest("/api/transactions/manual", "POST", {
      kind: "expense",
      amountToman: 786000,
      occurredAt: "2026-09-03T22:22:00.000Z",
      note: "خرید",
    }), manual.response);
    expect(manual.status()).toBe(201);

    const stream = fakeResponse();
    await handle(fakeRequest("/api/chat", "POST", { messages: [userMessage] }), stream.response);
    expect(stream.status()).toBe(200);

    const systemMessage = state.models
      .flatMap((model) => model.doStreamCalls)
      .flatMap((call) => call.prompt)
      .find((message) => message.role === "system");
    expect(systemMessage).toBeDefined();
    const content = String(systemMessage?.content ?? "");
    expect(content).toContain("1405/06/13 01:52");
    expect(content).toContain("جلالی");
    expect(content).not.toContain("2026-09-03T22:22:00.000Z");
  });
});
