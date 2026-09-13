import type { UIMessage } from "ai";

export type ConversationRecord = { id: string; number: number };

// Chat persistence seam. The D1 and in-memory adapters both uphold this
// contract: `saveMessages` stores exactly the last `window` messages, writes
// only ids that are not stored yet, and never rewrites a stored row.
export interface ChatStorage {
  listMessages(conversationId: string): Promise<UIMessage[]>;
  saveMessages(conversationId: string, messages: UIMessage[], window: number): Promise<void>;
  listConversations(): Promise<ConversationRecord[]>;
  createConversation(): Promise<ConversationRecord>;
  removeConversation(id: string): Promise<void>;
}

// Pure windowing used by the in-memory adapter and its tests. The D1 adapter
// reaches the same postcondition with SQL, so the storage conformance test
// holds both adapters to this shape.
export function nextChatWindow(stored: UIMessage[], incoming: UIMessage[], window: number) {
  const plan = chatWindowPlan(stored.map((message) => message.id), incoming, window);
  return {
    kept: stored.filter((message) => plan.keepIds.has(message.id)),
    added: plan.recent.filter((message) => !plan.storedIds.has(message.id)),
    staleIds: plan.staleIds,
  };
}

export function chatWindowPlan(storedIds: string[], incoming: UIMessage[], window: number) {
  const recent = incoming.slice(-window);
  const keepIds = new Set(recent.map((message) => message.id));
  const storedIdSet = new Set(storedIds);
  return { recent, keepIds, storedIds: storedIdSet, staleIds: storedIds.filter((id) => !keepIds.has(id)) };
}
