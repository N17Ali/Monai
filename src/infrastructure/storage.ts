import type { ChatStorage } from "../features/chat/chat.storage";
import type { TransactionStorage } from "../features/transactions/transaction.storage";

// One composed storage port. A per-backend factory builds a concrete
// implementation, so the application module depends on this seam rather than
// on D1.
export type Storage = {
  chat: ChatStorage;
  transactions: TransactionStorage;
};
