export type ConversationRecord = { id: string; number: number };

export function createConversationStore() {
  let conversations: ConversationRecord[] = [];
  function ensureDefault() {
    if (conversations.length === 0) conversations = [{ id: "conversation-1", number: 1 }];
  }
  return {
    list: () => {
      ensureDefault();
      return [...conversations];
    },
    create: () => {
      ensureDefault();
      const number = conversations.reduce((max, conversation) => Math.max(max, conversation.number), 0) + 1;
      const record = { id: crypto.randomUUID(), number };
      conversations = [...conversations, record];
      return record;
    },
    remove: (id: string) => {
      conversations = conversations.filter((conversation) => conversation.id !== id);
      ensureDefault();
    },
  };
}
