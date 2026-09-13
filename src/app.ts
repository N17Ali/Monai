import { createChatRoutes, type ChatConfig } from "./features/chat/chat.routes";
import { createEnrichmentRoutes } from "./features/enrichment/enrichment.routes";
import { createImportRoutes } from "./features/imports/import.routes";
import { createTransactionRoutes } from "./features/transactions/transaction.routes";
import type { Storage } from "./infrastructure/storage";
import { apiError, json } from "./shared/http";

export type AppOptions = {
  storage: Storage;
  config: ChatConfig;
};

// The API's single seam. The Worker adapter and the Vite bridge both call the
// handler this returns, so tests cross exactly the interface that ships. Every
// feature route is a module over the injected Storage port — there is no
// second, dev-only implementation of the routes.
export function createApp(options: AppOptions) {
  const { storage } = options;
  const chatRoutes = createChatRoutes({
    chat: storage.chat,
    config: options.config,
    loadVerifiedTransactions: () => storage.transactions.listVerified(),
  });
  const transactionRoutes = createTransactionRoutes(storage.transactions);
  const enrichmentRoutes = createEnrichmentRoutes(storage.transactions);
  const importRoutes = createImportRoutes(storage.transactions);

  return async function app(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/api/health") return json({ ok: true });
    try {
      return (
        (await chatRoutes(request, path)) ??
        (await transactionRoutes(request, path)) ??
        (await enrichmentRoutes(request, path)) ??
        (await importRoutes(request, path)) ??
        json({ error: "مسیر پیدا نشد" }, { status: 404 })
      );
    } catch (error) {
      return apiError(error);
    }
  };
}
