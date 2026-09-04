import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const GOOGLE_MODEL_ID = "gemini-3.5-flash-lite";

export function createChatModel(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey })(GOOGLE_MODEL_ID);
}
