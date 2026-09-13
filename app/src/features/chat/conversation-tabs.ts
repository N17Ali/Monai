import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { chatHistoryQuery, chatKeys, conversationsQuery, createConversation, removeConversation } from "./api";

export function useConversationTabs() {
  const queryClient = useQueryClient();
  const [storedId, setStoredId] = useState(() => localStorage.getItem("monai-active-chat"));
  const conversationsResult = useQuery(conversationsQuery);
  const conversations = conversationsResult.data?.conversations ?? [];
  const activeId = conversations.some((conversation) => conversation.id === storedId) ? storedId : conversations[0]?.id;
  useEffect(() => { localStorage.removeItem("monai-chat-sessions"); }, []);
  useEffect(() => { if (activeId) localStorage.setItem("monai-active-chat", activeId); }, [activeId]);
  const history = useQuery({ ...chatHistoryQuery(activeId ?? "conversation-1"), enabled: activeId != null });
  const createMutation = useMutation({ mutationFn: createConversation, onSuccess: async (conversation) => { setStoredId(conversation.id); await queryClient.invalidateQueries({ queryKey: chatKeys.all }); } });
  const closeMutation = useMutation({
    mutationFn: removeConversation,
    onMutate: (id) => {
      queryClient.removeQueries({ queryKey: chatKeys.history(id) });
      queryClient.setQueryData<{ conversations: { id: string; number: number }[] }>(chatKeys.conversations, (current) => current ? { conversations: current.conversations.filter((conversation) => conversation.id !== id) } : current);
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: chatKeys.all }); },
    onError: () => { void queryClient.invalidateQueries({ queryKey: chatKeys.conversations }); },
  });
  function closeConversation(id: string) {
    const index = conversations.findIndex((conversation) => conversation.id === id);
    setStoredId(conversations[index - 1]?.id ?? conversations[index + 1]?.id ?? null);
    closeMutation.mutate(id);
  }
  function newConversation() { if (!createMutation.isPending) createMutation.mutate(); }
  return { conversationsResult, conversations, activeId, history, closeConversation, newConversation, selectConversation: setStoredId, creating: createMutation.isPending };
}
