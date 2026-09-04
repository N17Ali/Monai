import { z } from "zod";

export const AI_PUBLIC_ERROR = "پاسخ‌گویی موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.";

export const CHAT_HISTORY_LIMIT = 20;

export const chatMessagePartSchema = z.object({ type: z.string() }).loose();

export const chatMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(["system", "user", "assistant"]),
    parts: z.array(chatMessagePartSchema),
  })
  .loose();

export const chatRequestSchema = z.object({ messages: z.array(chatMessageSchema) });

export const chatHistoryResponseSchema = z.object({ messages: z.array(chatMessageSchema) });
