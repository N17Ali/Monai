import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Transaction } from "../../../shared/contracts/transaction";
import type { Database } from "../../infrastructure/db/client";
import { transactions, type TransactionRow } from "../../infrastructure/db/schema";
import type { NewVerifiedTransaction, TransactionStorage } from "./transaction.storage";

function toTransaction(row: TransactionRow): Transaction {
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

function isUniqueViolation(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint|constraint failed|constraint/i.test(message);
}

// D1 adapter behind the transaction persistence seam. Identity is closed over
// here, so no route or domain module needs the user id or a Drizzle handle.
export function createD1TransactionStorage(db: Database, userId: string): TransactionStorage {
  return {
    createDraft: async (draft) => {
      try {
        await db.insert(transactions).values({
          id: draft.id,
          userId,
          source: draft.source,
          status: "needs_review",
          kind: draft.kind,
          amountRial: draft.amountRial,
          occurredAt: draft.occurredAt,
          sourceDateText: draft.sourceDateText,
          dateWasInferred: draft.dateWasInferred,
          bankId: draft.bankId,
          accountId: draft.accountId,
          balanceAfterRial: draft.balanceAfterRial,
          originalMessage: draft.originalMessage,
          fingerprint: draft.fingerprint,
          extractionMeta: draft.extractionMeta,
          createdAt: new Date().toISOString(),
        });
        return { status: "created", id: draft.id };
      } catch (error) {
        if (isUniqueViolation(error)) return { status: "duplicate" };
        throw error;
      }
    },
    createVerified: async (transaction: NewVerifiedTransaction) => {
      await db.insert(transactions).values({
        id: transaction.id,
        userId,
        source: transaction.source,
        status: "verified",
        kind: transaction.kind,
        amountRial: transaction.amountRial,
        occurredAt: transaction.occurredAt,
        sourceDateText: transaction.sourceDateText ?? null,
        dateWasInferred: transaction.dateWasInferred ?? false,
        bankId: transaction.bankId ?? null,
        accountId: transaction.accountId ?? null,
        balanceAfterRial: transaction.balanceAfterRial ?? null,
        bankDescription: transaction.bankDescription ?? null,
        userNote: transaction.userNote,
        categoryId: transaction.categoryId ?? null,
        originalMessage: transaction.originalMessage ?? null,
        createdAt: transaction.createdAt,
        verifiedAt: transaction.verifiedAt,
      });
    },
    listDrafts: async () =>
      (await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.status, "needs_review")))
        .orderBy(desc(transactions.createdAt))).map(toTransaction),
    listVerified: async () =>
      (await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.status, "verified")))
        .orderBy(desc(transactions.occurredAt))).map(toTransaction),
    listVerifiedPage: async ({ limit, after }) => {
      const scope = and(eq(transactions.userId, userId), eq(transactions.status, "verified"));
      const where = after
        ? and(scope, or(
            lt(transactions.occurredAt, after.occurredAt),
            and(eq(transactions.occurredAt, after.occurredAt), lt(transactions.id, after.id)),
          ))
        : scope;
      return (await db.select().from(transactions).where(where).orderBy(desc(transactions.occurredAt), desc(transactions.id)).limit(limit)).map(toTransaction);
    },
    verify: async (id, correction) => {
      const update: Record<string, unknown> = {
        kind: correction.kind,
        amountRial: correction.amountRial,
        userNote: correction.userNote,
        status: "verified",
        verifiedAt: new Date().toISOString(),
      };
      if (correction.occurredAt != null) update.occurredAt = correction.occurredAt;
      const rows = await db
        .update(transactions)
        .set(update)
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId), eq(transactions.status, "needs_review")))
        .returning({ id: transactions.id });
      return rows.length > 0;
    },
    reject: async (id) => {
      const rows = await db
        .update(transactions)
        .set({ status: "rejected" })
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId), eq(transactions.status, "needs_review")))
        .returning({ id: transactions.id });
      return rows.length > 0;
    },
  };
}
