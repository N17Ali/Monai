import type { Transaction, TransactionKind } from "../../../shared/contracts/transaction";

// A new imported draft, after deterministic parsing. The caller supplies the
// `fingerprint`; the adapter's contract is that a draft whose fingerprint is
// already stored for this user returns `duplicate` instead of a second row.
export type NewTransactionDraft = {
  id: string;
  source: Transaction["source"];
  kind: TransactionKind;
  amountRial: number;
  occurredAt: string;
  sourceDateText: string | null;
  dateWasInferred: boolean;
  bankId: string | null;
  accountId: string | null;
  balanceAfterRial: number | null;
  originalMessage: string;
  fingerprint: string;
  extractionMeta: string;
};

// A transaction the user entered directly (manual entry), already validated and
// therefore persisted straight as verified. Optional fields default to null.
export type NewVerifiedTransaction = {
  id: string;
  source: Transaction["source"];
  kind: TransactionKind;
  amountRial: number;
  occurredAt: string;
  userNote: string | null;
  createdAt: string;
  verifiedAt: string;
  sourceDateText?: string | null;
  dateWasInferred?: boolean;
  bankId?: string | null;
  accountId?: string | null;
  balanceAfterRial?: number | null;
  bankDescription?: string | null;
  categoryId?: string | null;
  originalMessage?: string | null;
};

// User corrections applied when a draft is verified. `occurredAt` is present
// only when the user corrected the extracted date.
export type TransactionCorrection = {
  kind: TransactionKind;
  amountRial: number;
  userNote: string | null;
  occurredAt?: string;
};

export type VerifiedTransactionUpdate = {
  kind: TransactionKind;
  amountRial: number;
  userNote: string | null;
  occurredAt: string;
};

export type VerifiedPage = { limit: number; after?: { occurredAt: string; id: string } };

export type DraftWriteResult = { status: "created"; id: string } | { status: "duplicate" };

// Transaction persistence seam. The D1 and in-memory adapters both uphold this
// contract: `createDraft` deduplicates by fingerprint, `verify` and `reject`
// act only on a `needs_review` draft and report whether they matched, and
// `listVerifiedPage` returns rows ordered `occurredAt DESC, id DESC` strictly
// after the keyset cursor. `toTransaction` mapping stays behind the adapter.
export interface TransactionStorage {
  createDraft(draft: NewTransactionDraft): Promise<DraftWriteResult>;
  createVerified(transaction: NewVerifiedTransaction): Promise<void>;
  listDrafts(): Promise<Transaction[]>;
  listVerified(): Promise<Transaction[]>;
  listVerifiedPage(page: VerifiedPage): Promise<Transaction[]>;
  verify(id: string, correction: TransactionCorrection): Promise<boolean>;
  reject(id: string): Promise<boolean>;
  updateVerified(id: string, correction: VerifiedTransactionUpdate): Promise<boolean>;
  deleteVerified(id: string): Promise<boolean>;
}
