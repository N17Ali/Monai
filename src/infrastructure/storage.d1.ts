import { createD1ChatStorage } from "../features/chat/chat.d1";
import { createD1TransactionStorage } from "../features/transactions/transaction.d1";
import type { Database } from "./db/client";
import type { Storage } from "./storage";

// Production adapter: every port backed by the same D1 database handle.
export function createD1Storage(db: Database, userId: string): Storage {
  return {
    chat: createD1ChatStorage(db, userId),
    transactions: createD1TransactionStorage(db, userId),
  };
}
