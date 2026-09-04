import { manualTransactionSchema } from "../../../shared/contracts/transaction";
import type { Database } from "../../infrastructure/db/client";
import { json } from "../../shared/http";
import { transactionRepository, USER_ID } from "./transaction.repository";

export async function transactionRoutes(request: Request, path: string, db: Database) {
  const repository = transactionRepository(db);
  if (path === "/api/transactions" && request.method === "GET") return json({ transactions: await repository.listVerified() });
  if (path === "/api/transactions/manual" && request.method === "POST") {
    const input = manualTransactionSchema.parse(await request.json());
    const now = new Date(input.occurredAt).toISOString();
    const id = crypto.randomUUID();
    await repository.insert({ id, userId: USER_ID, source: "manual", status: "verified", kind: input.kind, amountRial: Math.round(input.amountToman * 10), occurredAt: now, userNote: input.note || null, createdAt: now, verifiedAt: now });
    return json({ status: "verified", id }, { status: 201 });
  }
  return null;
}
