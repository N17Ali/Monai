import { enrichmentUpdateSchema } from "../../../shared/contracts/transaction";
import type { Database } from "../../infrastructure/db/client";
import { json } from "../../shared/http";
import { transactionRepository } from "../transactions/transaction.repository";

export async function enrichmentRoutes(request: Request, path: string, db: Database) {
  const repository = transactionRepository(db);
  if (path === "/api/enrichment" && request.method === "GET") {
    const drafts = await repository.listDrafts();
    return json({ drafts, count: drafts.length });
  }
  const match = path.match(/^\/api\/enrichment\/([^/]+)$/);
  if (match && request.method === "POST") {
    const input = enrichmentUpdateSchema.parse(await request.json());
    await repository.verify(match[1], { kind: input.kind, amountRial: Math.round(input.amountToman * 10), userNote: input.note, occurredAt: input.occurredAt });
    return json({ status: "verified" });
  }
  if (match && request.method === "DELETE") {
    await repository.reject(match[1]);
    return json({ status: "rejected" });
  }
  return null;
}
