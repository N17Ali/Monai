import { z } from "zod";

export const AI_PUBLIC_ERROR = "پاسخ‌گویی موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.";

// Per-conversation cap on stored chat messages. The composer disables with an
// explanatory notice once a conversation reaches this length; continuing
// requires opening a new conversation. Saves also trim to this window as a
// server-side backstop. All persistence paths are chunked, so this is a
// product decision (token cost per turn), not a D1 constraint.
export const CHAT_HISTORY_LIMIT = 50;

export const chatMessagePartSchema = z.object({ type: z.string() }).loose();

export const chatMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(["system", "user", "assistant"]),
    parts: z.array(chatMessagePartSchema),
  })
  .loose();

export const chatRequestSchema = z.object({ conversationId: z.string().min(1).default("conversation-1"), messages: z.array(chatMessageSchema) });

export const chatHistoryResponseSchema = z.object({ messages: z.array(chatMessageSchema) });
export const conversationSchema = z.object({ id: z.string(), number: z.number().int().positive() });
export const conversationListResponseSchema = z.object({ conversations: z.array(conversationSchema) });
export const conversationCreateResponseSchema = z.object({ conversation: conversationSchema });
