// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiState = vi.hoisted(() => ({
  conversations: [{ id: "conversation-1", number: 1 }] as { id: string; number: number }[],
  histories: new Map<string, unknown[]>([["conversation-1", [{ id: "u1", role: "user", parts: [{ type: "text", text: "سلام قدیمی" }] }]]]),
  blockedConversationId: null as string | null,
}));

vi.mock("@/shared/api/client", () => ({
  api: (path: string, init?: { method?: string }) => {
    if (path === "/api/chat/conversations") {
      if (init?.method === "POST") {
        const conversation = { id: "conversation-2", number: 2 };
        apiState.conversations = [...apiState.conversations, conversation];
        return Promise.resolve({ conversation });
      }
      return Promise.resolve({ conversations: apiState.conversations.map((conversation) => ({ ...conversation })) });
    }
    const match = path.match(/^\/api\/chat\/conversations\/(.+)$/);
    if (match && init?.method === "DELETE") {
      apiState.conversations = apiState.conversations.filter((conversation) => conversation.id !== match[1]);
      if (apiState.conversations.length === 0) {
        apiState.conversations = [{ id: "conversation-1", number: 1 }];
        apiState.histories.delete("conversation-1");
        apiState.blockedConversationId = "conversation-1";
      }
      return Promise.resolve({ status: "removed" });
    }
    if (path.startsWith("/api/chat/messages")) {
      const conversationId = new URLSearchParams(path.split("?")[1] ?? "").get("conversationId") ?? "conversation-1";
      if (conversationId === apiState.blockedConversationId) return new Promise(() => {});
      return Promise.resolve({ messages: apiState.histories.get(conversationId) ?? [] });
    }
    return Promise.reject(new Error(`unexpected path: ${path}`));
  },
}));

vi.mock("@/shared/hooks/use-is-desktop", () => ({ useIsDesktop: () => false }));

const { ChatView } = await import("@/features/chat/chat-view");

function renderChatView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><ChatView /></QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  apiState.conversations = [{ id: "conversation-1", number: 1 }];
  apiState.histories = new Map([["conversation-1", [{ id: "u1", role: "user", parts: [{ type: "text", text: "سلام قدیمی" }] }]]]);
  apiState.blockedConversationId = null;
});

afterEach(cleanup);

describe("chat tab transitions", () => {
  it("never shows the closed conversation's cached messages when its tab is closed", async () => {
    renderChatView();
    expect(await screen.findByText("سلام قدیمی")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "بستن گفت‌وگوی ۱" }));

    await waitFor(() => expect(screen.queryByText("سلام قدیمی")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toBeVisible();
  });

  it("shows a loading indicator when switching to a conversation that has not loaded yet", async () => {
    renderChatView();
    expect(await screen.findByText("سلام قدیمی")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "گفت‌وگوی جدید" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "گفت‌وگوی ۲" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "گفت‌وگوی ۲" }));

    await waitFor(() => expect(screen.getByRole("status")).toBeVisible());
    expect(screen.queryByText("سلام قدیمی")).not.toBeInTheDocument();
  });
});
