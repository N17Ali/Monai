import type { Transaction } from "../../shared/contracts/transaction";
import { createMemoryChatStorage } from "../features/chat/chat.memory";
import { createMemoryTransactionStorage } from "../features/transactions/transaction.memory";
import type { Storage } from "./storage";

// Dev-and-test adapter. `seed` pre-populates verified transactions so callers
// that only read (for example the chat context) can be tested without writes.
export function createMemoryStorage(userId: string, seed: Transaction[] = []): Storage {
  return {
    chat: createMemoryChatStorage(userId),
    transactions: createMemoryTransactionStorage(userId, seed),
  };
}
