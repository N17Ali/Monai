// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  conversations: [{ id: "conversation-1", number: 1 }] as { id: string; number: number }[],
  messagesByConversation: new Map<string, unknown[]>(),
}));

vi.mock("@/shared/api/client", () => ({
  api: (path: string, init?: { method?: string }) => {
    if (path === "/api/chat/conversations") {
      if (init?.method === "POST") {
        const conversation = { id: "conversation-2", number: 2 };
        state.conversations = [...state.conversations, conversation];
        return Promise.resolve({ conversation });
      }
      return Promise.resolve({ conversations: state.conversations.map((conversation) => ({ ...conversation })) });
    }
    if (path.startsWith("/api/chat/messages")) {
      const conversationId = new URLSearchParams(path.split("?")[1] ?? "").get("conversationId") ?? "conversation-1";
      return Promise.resolve({ messages: state.messagesByConversation.get(conversationId) ?? [] });
    }
    return Promise.reject(new Error(`unexpected path: ${path}`));
  },
}));

vi.mock("@/shared/hooks/use-is-desktop", () => ({ useIsDesktop: () => false }));

const { ChatView } = await import("@/features/chat/chat-view");

function message(id: string) {
  return { id, role: "user", parts: [{ type: "text", text: `پیام ${id}` }] };
}

function seed(conversationId: string, count: number) {
  state.messagesByConversation.set(conversationId, Array.from({ length: count }, (_, index) => message(`m${index}`)));
}

function renderChatView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><ChatView /></QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  state.conversations = [{ id: "conversation-1", number: 1 }];
  state.messagesByConversation = new Map();
});

afterEach(cleanup);

describe("conversation message limit", () => {
  it("disables the composer and explains the limit at 50 messages", async () => {
    seed("conversation-1", 50);
    renderChatView();
    await waitFor(() => expect(screen.getByText(/به سقف ۵۰ پیام رسیده است/)).toBeInTheDocument());
    expect(screen.getByPlaceholderText("مثلاً این ماه چقدر خرج کردم؟")).toBeDisabled();
    expect(screen.getByRole("button", { name: "بپرس" })).toBeDisabled();
    expect(within(screen.getByRole("status")).getByRole("button", { name: "گفت‌وگوی جدید" })).toBeInTheDocument();
  });

  it("keeps the composer available below the limit", async () => {
    seed("conversation-1", 49);
    renderChatView();
    const textarea = await screen.findByPlaceholderText("مثلاً این ماه چقدر خرج کردم؟");
    await waitFor(() => expect(textarea).toBeEnabled());
    expect(screen.getByText("پیام m48")).toBeInTheDocument();
    expect(screen.queryByText(/به سقف ۵۰ پیام رسیده است/)).not.toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: "سلام" } });
    expect(screen.getByRole("button", { name: "بپرس" })).toBeEnabled();
  });

  it("re-enables the composer after opening a new conversation from the notice", async () => {
    seed("conversation-1", 50);
    renderChatView();
    await waitFor(() => expect(screen.getByText(/به سقف ۵۰ پیام رسیده است/)).toBeInTheDocument());
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "گفت‌وگوی جدید" }));
    await waitFor(() => expect(screen.getByPlaceholderText("مثلاً این ماه چقدر خرج کردم؟")).toBeEnabled());
    expect(screen.queryByText(/به سقف ۵۰ پیام رسیده است/)).not.toBeInTheDocument();
  });
});
