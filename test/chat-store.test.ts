import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { createChatHistoryStore, mergeChatMessages } from "../src/features/chat/chat-store";

function message(id: string, role: UIMessage["role"], text: string): UIMessage {
  return { id, role, parts: [{ type: "text", text }] };
}

describe("chat message merge", () => {
  it("appends new messages after existing ones", () => {
    const merged = mergeChatMessages([message("u1", "user", "سلام")], [message("a1", "assistant", "درود")]);
    expect(merged.map((item) => item.id)).toEqual(["u1", "a1"]);
  });

  it("updates a message in place instead of duplicating it", () => {
    const merged = mergeChatMessages([message("u1", "user", "سلام"), message("a1", "assistant", "در")], [message("a1", "assistant", "درود")]);
    expect(merged.map((item) => item.id)).toEqual(["u1", "a1"]);
    expect(merged[1]?.parts[0]).toEqual({ type: "text", text: "درود" });
  });

  it("keeps conversation order when the full history is saved again", () => {
    const history = [message("u1", "user", "سؤال ۱"), message("a1", "assistant", "پاسخ ۱")];
    const merged = mergeChatMessages(history, [...history, message("u2", "user", "سؤال ۲")]);
    expect(merged.map((item) => item.id)).toEqual(["u1", "a1", "u2"]);
  });
});

describe("chat history store", () => {
  it("starts empty and saves streamed turns", () => {
    const store = createChatHistoryStore();
    expect(store.list()).toEqual([]);
    store.save([message("u1", "user", "سلام")]);
    store.save([message("u1", "user", "سلام"), message("a1", "assistant", "درود")]);
    expect(store.list().map((item) => item.role)).toEqual(["user", "assistant"]);
  });

  it("replaces an aborted partial answer with the completed one", () => {
    const store = createChatHistoryStore();
    store.save([message("u1", "user", "سلام"), message("a1", "assistant", "در")]);
    store.save([message("u1", "user", "سلام"), message("a1", "assistant", "درود کامل")]);
    expect(store.list()).toHaveLength(2);
    expect(store.list()[1]?.parts[0]).toEqual({ type: "text", text: "درود کامل" });
  });

  it("keeps only the most recent messages once the history passes the window", () => {
    const store = createChatHistoryStore();
    const many = Array.from({ length: 30 }, (_, index) => message(`m${index}`, index % 2 === 0 ? "user" : "assistant"));
    store.save(many);
    const listed = store.list();
    expect(listed).toHaveLength(20);
    expect(listed[0]?.id).toBe("m10");
    expect(listed.at(-1)?.id).toBe("m29");
  });
});
