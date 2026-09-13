import type { Transaction } from "../../../shared/contracts/transaction";
import type { NewVerifiedTransaction, TransactionStorage } from "./transaction.storage";

type Record = { transaction: Transaction; fingerprint: string | null; createdAt: string };

function toRecord(transaction: Transaction, createdAt: string): Record {
  return { transaction, fingerprint: null, createdAt };
}

function compareVerified(a: Transaction, b: Transaction) {
  const byTime = b.occurredAt.localeCompare(a.occurredAt);
  if (byTime !== 0) return byTime;
  return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
}

// In-memory adapter behind the transaction persistence seam, used by the Vite
// dev server and the dev route tests. It mirrors the D1 adapter's postconditions
// so the two adapters cannot disagree on duplicate detection, the needs_review
// gate on verify/reject, or the keyset page ordering.
export function createMemoryTransactionStorage(_userId: string, seed: Transaction[] = []): TransactionStorage {
  const records = new Map<string, Record>();
  const fingerprintIndex = new Map<string, string>();

  for (const transaction of seed) records.set(transaction.id, toRecord(transaction, transaction.occurredAt));

  const verified = () => [...records.values()].filter((record) => record.transaction.status === "verified").map((record) => record.transaction).sort(compareVerified);

  return {
    createDraft: async (draft) => {
      if (fingerprintIndex.has(draft.fingerprint)) return { status: "duplicate" };
      const transaction: Transaction = {
        id: draft.id,
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
        bankDescription: null,
        userNote: null,
        categoryId: null,
        originalMessage: draft.originalMessage,
      };
      records.set(draft.id, { transaction, fingerprint: draft.fingerprint, createdAt: new Date().toISOString() });
      fingerprintIndex.set(draft.fingerprint, draft.id);
      return { status: "created", id: draft.id };
    },
    createVerified: async (input: NewVerifiedTransaction) => {
      const transaction: Transaction = {
        id: input.id,
        source: input.source,
        status: "verified",
        kind: input.kind,
        amountRial: input.amountRial,
        occurredAt: input.occurredAt,
        sourceDateText: input.sourceDateText ?? null,
        dateWasInferred: input.dateWasInferred ?? false,
        bankId: input.bankId ?? null,
        accountId: input.accountId ?? null,
        balanceAfterRial: input.balanceAfterRial ?? null,
        bankDescription: input.bankDescription ?? null,
        userNote: input.userNote,
        categoryId: input.categoryId ?? null,
        originalMessage: input.originalMessage ?? null,
      };
      records.set(input.id, toRecord(transaction, input.createdAt));
    },
    listDrafts: async () =>
      [...records.values()]
        .filter((record) => record.transaction.status === "needs_review")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((record) => record.transaction),
    listVerified: async () => verified(),
    listVerifiedPage: async ({ limit, after }) => {
      const isAfter = (transaction: Transaction) =>
        !after || transaction.occurredAt < after.occurredAt || (transaction.occurredAt === after.occurredAt && transaction.id < after.id);
      return verified().filter(isAfter).slice(0, limit);
    },
    verify: async (id, correction) => {
      const record = records.get(id);
      if (!record || record.transaction.status !== "needs_review") return false;
      record.transaction = {
        ...record.transaction,
        kind: correction.kind,
        amountRial: correction.amountRial,
        userNote: correction.userNote,
        occurredAt: correction.occurredAt ?? record.transaction.occurredAt,
        status: "verified",
      };
      return true;
    },
    reject: async (id) => {
      const record = records.get(id);
      if (!record || record.transaction.status !== "needs_review") return false;
      record.transaction = { ...record.transaction, status: "rejected" };
      return true;
    },
  };
}
