import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { AI_PUBLIC_ERROR } from "@shared/contracts/ai";
import { Conversation, ConversationContent, ConversationEmptyState } from "@/components/ai-elements/conversation";
import { Markdown } from "@/components/ai-elements/markdown";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { ThinkingDots } from "@/components/ai-elements/thinking";
import { Button } from "@/components/ui/button";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";
import { chatHistoryQuery } from "./api";

const transport = new DefaultChatTransport({ api: "/api/chat" });

function textParts(message: UIMessage) {
  return message.parts.filter((part): part is { type: "text"; text: string } => part.type === "text");
}

function hasVisibleText(message: UIMessage) {
  return textParts(message).some((part) => part.text !== "");
}

function ChatConversation({ initialMessages }: { initialMessages: UIMessage[] }) {
  const [input, setInput] = useState("");
  const isDesktop = useIsDesktop();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef(0);
  const { messages, sendMessage, status, error } = useChat({ id: "monai", messages: initialMessages, throttle: 50, transport });
  const lastMessage = messages.at(-1);
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
    <div className="flex h-[calc(100dvh-12rem)] flex-col lg:h-[calc(100dvh-10rem)]">
      <Conversation className="-mx-4 lg:-mx-10" onWheel={stopScrollAnimation} onTouchStart={stopScrollAnimation} ref={scrollRef}>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState title="گفت‌وگو درباره پول" description="فقط درباره تراکنش‌های تأییدشده سؤال بپرس." />
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
              <ThinkingDots />
            </Message>
          )}
        </ConversationContent>
      </Conversation>
      {error && <p className="mx-auto w-full max-w-3xl rounded-lg bg-expense/10 p-3 text-sm text-expense">{AI_PUBLIC_ERROR}</p>}
      <PromptInput className="mx-auto mt-4 w-full max-w-3xl" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <PromptInputTextarea
          onChange={(event) => setInput(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="مثلاً این ماه چقدر خرج کردم؟"
          value={input}
        />
        <PromptInputSubmit disabled={!input.trim() || status === "submitted" || status === "streaming"}>
          {status === "submitted" || status === "streaming" ? "در حال پاسخ" : "بپرس"}
        </PromptInputSubmit>
      </PromptInput>
      <p className="mx-auto mt-2 hidden w-full max-w-3xl text-xs text-muted-foreground lg:block">
        ارسال با Enter — خط جدید با Shift+Enter یا Ctrl+Enter
      </p>
    </div>
  );
}

export function ChatView() {
  const { data, isPending, isError, refetch } = useQuery(chatHistoryQuery);
  if (isPending) {
    return (
      <div className="grid min-h-[calc(100dvh-12rem)] place-content-center lg:min-h-[calc(100dvh-10rem)]">
        <p className="text-sm text-muted-foreground">در حال بارگذاری گفت‌وگو...</p>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="grid min-h-[calc(100dvh-12rem)] place-content-center justify-items-center gap-3 lg:min-h-[calc(100dvh-10rem)]">
        <p className="text-sm text-muted-foreground">گفت‌وگو بارگذاری نشد.</p>
        <Button onClick={() => void refetch()} variant="secondary">
          تلاش دوباره
        </Button>
      </div>
    );
  }
  return <ChatConversation initialMessages={data.messages} />;
}
