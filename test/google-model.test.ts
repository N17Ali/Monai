import { describe, expect, it } from "vitest";
import { GOOGLE_MODEL_ID } from "../src/features/chat/model";

describe("server AI model configuration", () => {
  it("uses the configured chat model", () => {
    expect(GOOGLE_MODEL_ID).toBe("gemini-3.5-flash-lite");
  });
});
