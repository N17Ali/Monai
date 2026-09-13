import { enrichmentUpdateSchema } from "../../../shared/contracts/transaction";
import { tomanToRial } from "../../../shared/money";
import { json } from "../../shared/http";
import type { TransactionStorage } from "../transactions/transaction.storage";

// Enrichment HTTP module. Verification and rejection act only on a draft still
// in `needs_review`; a miss is a 404, never a false success.
export function createEnrichmentRoutes(storage: TransactionStorage) {
  return async function enrichmentRoutes(request: Request, path: string): Promise<Response | null> {
    if (path === "/api/enrichment" && request.method === "GET") {
      const drafts = await storage.listDrafts();
      return json({ drafts, count: drafts.length });
    }
    const match = path.match(/^\/api\/enrichment\/([^/]+)$/);
    if (match && request.method === "POST") {
      const input = enrichmentUpdateSchema.parse(await request.json());
      const found = await storage.verify(match[1], { kind: input.kind, amountRial: tomanToRial(input.amountToman), userNote: input.note, occurredAt: input.occurredAt });
      if (!found) return json({ error: "پیش‌نویس پیدا نشد" }, { status: 404 });
      return json({ status: "verified" });
    }
    if (match && request.method === "DELETE") {
      const found = await storage.reject(match[1]);
      if (!found) return json({ error: "پیش‌نویس پیدا نشد" }, { status: 404 });
      return json({ status: "rejected" });
    }
    return null;
  };
}
