import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Database } from "../../infrastructure/db/client";
import { transactions, type TransactionRow } from "../../infrastructure/db/schema";
import type { Transaction } from "../../../shared/contracts/transaction";

export const USER_ID = "local-user";

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    source: row.source as Transaction["source"],
    status: row.status as Transaction["status"],
    kind: row.kind as Transaction["kind"],
    amountRial: row.amountRial,
    occurredAt: row.occurredAt,
    sourceDateText: row.sourceDateText,
    dateWasInferred: row.dateWasInferred,
    bankId: row.bankId,
    accountId: row.accountId,
    balanceAfterRial: row.balanceAfterRial,
    bankDescription: row.bankDescription,
    userNote: row.userNote,
    categoryId: row.categoryId,
    originalMessage: row.originalMessage,
  };
}

export function transactionRepository(db: Database) {
  return {
    listVerified: async () => (await db.select().from(transactions).where(and(eq(transactions.userId, USER_ID), eq(transactions.status, "verified"))).orderBy(desc(transactions.occurredAt))).map(toTransaction),
    listVerifiedPage: async (options: { limit: number; after?: { occurredAt: string; id: string } }) => {
      const scope = and(eq(transactions.userId, USER_ID), eq(transactions.status, "verified"));
      const where = options.after
        ? and(scope, or(
            lt(transactions.occurredAt, options.after.occurredAt),
            and(eq(transactions.occurredAt, options.after.occurredAt), lt(transactions.id, options.after.id)),
          ))
        : scope;
      return (await db.select().from(transactions).where(where).orderBy(desc(transactions.occurredAt), desc(transactions.id)).limit(options.limit)).map(toTransaction);
    },
    listDrafts: async () => (await db.select().from(transactions).where(and(eq(transactions.userId, USER_ID), eq(transactions.status, "needs_review"))).orderBy(desc(transactions.createdAt))).map(toTransaction),
    insert: (values: typeof transactions.$inferInsert) => db.insert(transactions).values(values),
    verify: (id: string, values: { kind: string; amountRial: number; userNote: string; occurredAt?: string }) => {
      const update: Record<string, unknown> = { kind: values.kind, amountRial: values.amountRial, userNote: values.userNote, status: "verified", verifiedAt: new Date().toISOString() };
      if (values.occurredAt != null) update.occurredAt = values.occurredAt;
      return db.update(transactions).set(update).where(and(eq(transactions.id, id), eq(transactions.userId, USER_ID), eq(transactions.status, "needs_review")));
    },
    reject: (id: string) => db.update(transactions).set({ status: "rejected" }).where(and(eq(transactions.id, id), eq(transactions.userId, USER_ID), eq(transactions.status, "needs_review"))),
  };
}
