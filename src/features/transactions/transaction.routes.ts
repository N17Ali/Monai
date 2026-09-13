import { manualTransactionSchema } from "../../../shared/contracts/transaction";
import { tomanToRial } from "../../../shared/money";
import { json } from "../../shared/http";
import type { TransactionStorage } from "./transaction.storage";

const MAX_PAGE_SIZE = 100;

export function transactionsCursor(transaction: { occurredAt: string; id: string }) {
  return `${transaction.occurredAt}|${transaction.id}`;
}

// Transaction HTTP module. The storage port is injected, so the Worker and the
// Vite dev server run the same route logic over different adapters.
export function createTransactionRoutes(storage: TransactionStorage) {
  return async function transactionRoutes(request: Request, path: string): Promise<Response | null> {
    if (path === "/api/transactions" && request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const limitParam = params.get("limit");
      if (limitParam == null) return json({ transactions: await storage.listVerified(), nextCursor: null });
      const limit = Number(limitParam);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) return json({ error: "اندازه صفحه معتبر نیست" }, { status: 400 });
      const cursor = params.get("cursor");
      let after: { occurredAt: string; id: string } | undefined;
      if (cursor != null) {
        const separator = cursor.indexOf("|");
        if (separator <= 0 || separator === cursor.length - 1) return json({ error: "پارامتر صفحه‌بندی معتبر نیست" }, { status: 400 });
        after = { occurredAt: cursor.slice(0, separator), id: cursor.slice(separator + 1) };
      }
      const rows = await storage.listVerifiedPage({ limit, after });
      const last = rows.at(-1);
      return json({ transactions: rows, nextCursor: rows.length === limit && last ? transactionsCursor(last) : null });
    }
    if (path === "/api/transactions/manual" && request.method === "POST") {
      const input = manualTransactionSchema.parse(await request.json());
      const now = new Date(input.occurredAt).toISOString();
      const id = crypto.randomUUID();
      await storage.createVerified({ id, source: "manual", kind: input.kind, amountRial: tomanToRial(input.amountToman), occurredAt: now, userNote: input.note || null, createdAt: now, verifiedAt: now });
      return json({ status: "verified", id }, { status: 201 });
    }
    return null;
  };
}
