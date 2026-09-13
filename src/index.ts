import { CHAT_HISTORY_LIMIT } from "../shared/contracts/ai";
import { createApp } from "./app";
import { createChatModel } from "./features/chat/model";
import { createDb } from "./infrastructure/db/client";
import { USER_ID } from "./infrastructure/identity";
import { createD1Storage } from "./infrastructure/storage.d1";

// Worker adapter: build D1-backed storage, delegate to the shared application,
// and serve static assets for non-API paths. Every feature runs behind the same
// seam as the dev server; only the storage adapter differs.
export default {
  async fetch(request: Request, env: Env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    const db = createDb(env.DB);
    const app = createApp({
      storage: createD1Storage(db, USER_ID),
      config: { aiApiKey: env.GOOGLE_API_KEY, chatHistoryLimit: CHAT_HISTORY_LIMIT, createChatModel },
    });
    return app(request);
  },
};
