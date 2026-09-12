import { describe, expect, it } from "vitest";
import { createChatHistoryStore } from "../src/features/chat/chat-store";

describe("conversation store", () => {
  it("keeps histories isolated when switching conversations", () => {
    const store = createChatHistoryStore();
    store.save([{ id: "m1", role: "user", parts: [{ type: "text", text: "اول" }] }], "conversation-1");
    store.save([{ id: "m2", role: "user", parts: [{ type: "text", text: "دوم" }] }], "conversation-2");
    expect(store.list("conversation-1")[0]?.parts[0]).toEqual({ type: "text", text: "اول" });
    expect(store.list("conversation-2")[0]?.parts[0]).toEqual({ type: "text", text: "دوم" });
  });
});
