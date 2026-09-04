import { createDb } from "./infrastructure/db/client";
import { apiError, json } from "./shared/http";
import { enrichmentRoutes } from "./features/enrichment/enrichment.routes";
import { importRoutes } from "./features/imports/import.routes";
import { transactionRoutes } from "./features/transactions/transaction.routes";
import { chatRoutes } from "./features/chat/chat.routes";

export default {
  async fetch(request: Request, env: Env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (path === "/api/health") return json({ ok: true });
    const db = createDb(env.DB);
    try {
      return (
        (await importRoutes(request, path, db)) ??
        (await enrichmentRoutes(request, path, db)) ??
        (await transactionRoutes(request, path, db)) ??
        (await chatRoutes(request, path, db, env)) ??
        json({ error: "مسیر پیدا نشد" }, { status: 404 })
      );
    } catch (error) {
      return apiError(error);
    }
  },
};
