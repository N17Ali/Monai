import { describe, expect, it } from "vitest";
import { chatHistoryResponseSchema, chatRequestSchema } from "../shared/contracts/ai";

describe("chat message contracts", () => {
  it("accepts AI SDK UI messages with text parts and extra fields", () => {
    const payload = {
      messages: [
        { id: "u1", role: "user", parts: [{ type: "text", text: "این ماه چقدر خرج کردم؟" }], metadata: { createdAt: 1 } },
        { id: "a1", role: "assistant", parts: [{ type: "reasoning", text: "..." }, { type: "text", text: "**۱٬۲۰۰٬۰۰۰ تومان**" }] },
      ],
    };
    expect(chatRequestSchema.parse(payload)).toBeTruthy();
    expect(chatHistoryResponseSchema.parse(payload)).toBeTruthy();
    expect(chatRequestSchema.parse(payload).messages[0]?.parts[0]).toEqual({ type: "text", text: "این ماه چقدر خرج کردم؟" });
  });

  it("rejects malformed messages", () => {
    expect(chatRequestSchema.safeParse({ messages: [{ id: "u1", role: "robot", parts: [] }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: [{ id: "u1", role: "user", parts: [{ text: "بدون نوع" }] }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: "بدون آرایه" }).success).toBe(false);
  });

  it("accepts an empty history response", () => {
    expect(chatHistoryResponseSchema.parse({ messages: [] })).toEqual({ messages: [] });
  });
});
