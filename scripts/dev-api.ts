import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { CHAT_HISTORY_LIMIT } from "../shared/contracts/ai";
import { createApp } from "../src/app";
import { createChatModel } from "../src/features/chat/model";
import { USER_ID } from "../src/infrastructure/identity";
import { createMemoryStorage } from "../src/infrastructure/storage.memory";

async function readText(request: IncomingMessage) {
  let value = "";
  for await (const chunk of request) value += chunk;
  return value;
}

async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const method = request.method ?? "GET";
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers ?? {})) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const body = method === "GET" || method === "HEAD" ? undefined : await readText(request);
  return new Request(new URL(request.url ?? "/", "http://localhost"), { method, headers, body });
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

// Vite dev bridge: the same application the Worker serves, over in-memory
// storage. There is no separate dev route implementation to keep in sync.
export function devApi(options: { aiApiKey?: string }): Plugin {
  return {
    name: "monai-dev-api",
    configureServer(server) {
      const app = createApp({
        storage: createMemoryStorage(USER_ID),
        config: { aiApiKey: options.aiApiKey, chatHistoryLimit: CHAT_HISTORY_LIMIT, createChatModel },
      });
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith("/api/")) return next();
        try {
          return pipeWebResponse(await app(await toWebRequest(request)), response);
        } catch {
          response.statusCode = 500;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "خطای داخلی سرور" }));
        }
      });
    },
  };
}
