import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Cancel01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { AI_PUBLIC_ERROR, CHAT_HISTORY_LIMIT } from "@shared/contracts/ai";
import { Conversation, ConversationContent, ConversationEmptyState } from "@/components/ai-elements/conversation";
import { Markdown } from "@/components/ai-elements/markdown";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { ThinkingDots } from "@/components/ai-elements/thinking";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";
import { chatHistoryQuery, chatKeys, conversationsQuery, createConversation, removeConversation } from "./api";

function textParts(message: UIMessage) {
  return message.parts.filter((part): part is { type: "text"; text: string } => part.type === "text");
}

function hasVisibleText(message: UIMessage) {
  return textParts(message).some((part) => part.text !== "");
}

function ChatConversation({ initialMessages, conversationId, onNewConversation }: { initialMessages: UIMessage[]; conversationId: string; onNewConversation: () => void }) {
  const [input, setInput] = useState("");
  const isDesktop = useIsDesktop();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef(0);
  const transport = new DefaultChatTransport({ api: "/api/chat", body: { conversationId } });
  const { messages, sendMessage, status, error, setMessages } = useChat({ id: conversationId, messages: initialMessages, throttle: 50, transport });
  const lastMessage = messages.at(-1);
  const limitReached = messages.length >= CHAT_HISTORY_LIMIT;
  const awaitingAnswer =
    (status === "submitted" || status === "streaming") && (lastMessage?.role !== "assistant" || !hasVisibleText(lastMessage));

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, []);

  useEffect(() => () => stopScrollAnimation(), []);

  function stopScrollAnimation() {
    if (scrollAnimationRef.current === 0) return;
    cancelAnimationFrame(scrollAnimationRef.current);
    scrollAnimationRef.current = 0;
  }

  function scrollToEnd() {
    const element = scrollRef.current;
    if (!element) return;
    stopScrollAnimation();
    const start = element.scrollTop;
    const distance = element.scrollHeight - element.clientHeight - start;
    if (distance <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.scrollTop = element.scrollHeight;
      return;
    }
    const duration = Math.min(450, Math.max(180, distance / 4));
    let elapsed = 0;
    let previous: number | undefined;
    const step = (timestamp: number) => {
      if (previous !== undefined) elapsed += timestamp - previous;
      previous = timestamp;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - progress) ** 3;
      const end = element.scrollHeight - element.clientHeight;
      element.scrollTop = start + (end - start) * eased;
      scrollAnimationRef.current = progress < 1 ? requestAnimationFrame(step) : 0;
    };
    scrollAnimationRef.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (messages.at(-1)?.role === "user") return scrollToEnd();
    if (scrollAnimationRef.current !== 0) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    if (nearBottom) element.scrollTop = element.scrollHeight;
  }, [messages, awaitingAnswer]);

  function submit() {
    const text = input.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    setInput("");
    void sendMessage({ text });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (!isDesktop) return;
    event.preventDefault();
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
      const textarea = event.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;
      const nextValue = `${value.slice(0, selectionStart)}\n${value.slice(selectionEnd)}`;
      textarea.value = nextValue;
      textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
      setInput(nextValue);
      return;
    }
    submit();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="-mx-4 lg:-mx-10" onWheel={stopScrollAnimation} onTouchStart={stopScrollAnimation} ref={scrollRef}>
        <ConversationContent>
          {messages.length === 0 ? (
            <><ConversationEmptyState title="از وضعیت مالی‌ات بپرس" description="پاسخ‌ها فقط بر اساس تراکنش‌های تأییدشده هستند." /><div className="mx-auto grid w-full max-w-3xl gap-2 p-4 sm:grid-cols-2">{["این ماه چقدر خرج کردم؟", "بیشترین هزینه‌ام چه بوده؟", "هزینه‌های حمل‌ونقل چقدر بوده؟", "موجودی حساب‌ها چقدر است؟"].map((prompt) => <Button key={prompt} onClick={() => { setInput(prompt); }} variant="secondary">{prompt}</Button>)}</div></>
          ) : (
            messages.map((message) => {
              if (message.role === "assistant" && !hasVisibleText(message)) return null;
              return (
                <Message from={message.role} key={message.id}>
                  <MessageContent className="flex flex-col gap-3" from={message.role}>
                    {message.role === "assistant"
                      ? textParts(message).map((part, index) => <Markdown content={part.text} key={index} />)
                      : textParts(message).map((part, index) => <MessageResponse key={index}>{part.text}</MessageResponse>)}
                  </MessageContent>
                </Message>
              );
            })
          )}
          {awaitingAnswer && (
            <Message className="pe-1 py-1.5" from="assistant">
              <div aria-label="در حال دریافت پاسخ" className="flex items-center gap-2" role="status"><ThinkingDots /><span className="sr-only">در حال دریافت پاسخ</span></div>
            </Message>
          )}
        </ConversationContent>
      </Conversation>
      {error && <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-lg bg-expense/10 p-3 text-sm text-expense" role="alert"><span>{AI_PUBLIC_ERROR} دوباره تلاش کن.</span><Button onClick={() => { const lastUser = [...messages].reverse().find((message) => message.role === "user"); const text = lastUser ? textParts(lastUser).map((part) => part.text).join("") : input; if (lastUser) setMessages(messages.filter((message) => message.id !== lastUser.id)); if (text) void sendMessage({ text }); }} variant="outline">تلاش دوباره</Button></div>}
      {limitReached && <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted p-3 text-sm text-muted-foreground" role="status"><span>این گفت‌وگو به سقف {new Intl.NumberFormat("fa-IR").format(CHAT_HISTORY_LIMIT)} پیام رسیده است. برای ادامه، گفت‌وگوی جدید باز کن.</span><Button onClick={onNewConversation} size="sm" variant="outline">گفت‌وگوی جدید</Button></div>}
      <PromptInput className="mx-auto mt-1 w-full max-w-3xl" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <PromptInputTextarea
          disabled={limitReached}
          onChange={(event) => setInput(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="مثلاً این ماه چقدر خرج کردم؟"
          value={input}
        />
        <PromptInputSubmit disabled={!input.trim() || status === "submitted" || status === "streaming" || limitReached}>
          {status === "submitted" || status === "streaming" ? "در حال پاسخ" : "بپرس"}
        </PromptInputSubmit>
      </PromptInput>
      <p className="mx-auto mt-2 hidden w-full max-w-3xl text-xs text-muted-foreground lg:block">
        ارسال با Enter — خط جدید با Shift+Enter یا Ctrl+Enter
      </p>
    </div>
  );
}

function conversationTitle(number: number) {
  return `گفت‌وگوی ${new Intl.NumberFormat("fa-IR").format(number)}`;
}

export function ChatView() {
  const queryClient = useQueryClient();
  const [storedId, setStoredId] = useState(() => localStorage.getItem("monai-active-chat"));
  useEffect(() => { localStorage.removeItem("monai-chat-sessions"); }, []);
  const conversationsResult = useQuery(conversationsQuery);
  const conversations = conversationsResult.data?.conversations ?? [];
  const activeId = conversations.some((conversation) => conversation.id === storedId) ? storedId : conversations[0]?.id;
  useEffect(() => { if (activeId) localStorage.setItem("monai-active-chat", activeId); }, [activeId]);
  const history = useQuery({ ...chatHistoryQuery(activeId ?? "conversation-1"), enabled: activeId != null });
  const createMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: async (conversation) => {
      setStoredId(conversation.id);
      await queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
  const closeMutation = useMutation({
    mutationFn: removeConversation,
    onMutate: (id) => {
      queryClient.removeQueries({ queryKey: chatKeys.history(id) });
      queryClient.setQueryData<{ conversations: { id: string; number: number }[] }>(chatKeys.conversations, (current) =>
        current ? { conversations: current.conversations.filter((conversation) => conversation.id !== id) } : current,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });

  if (conversationsResult.isPending) {
    return (
      <div className="grid min-h-[calc(100dvh-12rem)] place-content-center lg:min-h-[calc(100dvh-10rem)]">
        <p className="text-sm text-muted-foreground" role="status">در حال بارگذاری گفت‌وگو...</p>
      </div>
    );
  }
  if (conversationsResult.isError) {
    return (
      <div className="grid min-h-[calc(100dvh-12rem)] place-content-center justify-items-center gap-3 lg:min-h-[calc(100dvh-10rem)]">
        <p className="text-sm text-muted-foreground">گفت‌وگو بارگذاری نشد.</p>
        <Button onClick={() => void conversationsResult.refetch()} variant="secondary">تلاش دوباره</Button>
      </div>
    );
  }

  function closeConversation(id: string) {
    const index = conversations.findIndex((conversation) => conversation.id === id);
    const fallback = conversations[index - 1] ?? conversations[index + 1];
    setStoredId(fallback?.id ?? null);
    closeMutation.mutate(id);
  }

  function newConversation() {
    if (createMutation.isPending) return;
    createMutation.mutate();
  }

  return <div className="flex h-[calc(100dvh-12rem)] flex-col gap-3 lg:h-[calc(100dvh-10rem)]"><div aria-label="فهرست گفت‌وگوها" className="flex shrink-0 gap-2 overflow-x-auto pb-1">{conversations.map((conversation) => { const active = conversation.id === activeId; const title = conversationTitle(conversation.number); return <div className={`flex min-h-11 shrink-0 items-center rounded-md ${active ? "bg-secondary text-secondary-foreground" : "hover:bg-accent hover:text-accent-foreground"}`} key={conversation.id}><Button aria-current={active ? "page" : undefined} className="min-h-11 hover:bg-transparent" onClick={() => setStoredId(conversation.id)} size="sm" variant="ghost">{title}</Button><Button aria-label={`بستن ${title}`} className="size-11 hover:bg-transparent" onClick={() => closeConversation(conversation.id)} size="icon-sm" variant="ghost"><HugeiconsIcon icon={Cancel01Icon} size={14} /></Button></div>; })}<Button className="min-h-11 shrink-0" disabled={createMutation.isPending} onClick={newConversation} size="sm" variant="outline"><HugeiconsIcon icon={PlusSignIcon} size={16} />گفت‌وگوی جدید</Button></div>{activeId == null || history.isPending ? <ChatLoading /> : history.isError ? <div className="grid min-h-0 flex-1 place-content-center justify-items-center gap-3"><p className="text-sm text-muted-foreground">پیام‌ها بارگذاری نشد.</p><Button onClick={() => void history.refetch()} variant="secondary">تلاش دوباره</Button></div> : <ChatConversation conversationId={activeId} initialMessages={history.data?.messages ?? []} key={activeId} onNewConversation={newConversation} />}</div>;
}

function ChatLoading() {
  return <div className="grid min-h-0 flex-1 place-content-center"><div className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Spinner />در حال بارگذاری پیام‌ها...</div></div>;
}
