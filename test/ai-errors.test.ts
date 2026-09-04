import { describe, expect, it } from "vitest";
import { AI_PUBLIC_ERROR } from "../shared/contracts/ai";

describe("client AI errors", () => {
  it("uses provider-neutral wording", () => {
    expect(AI_PUBLIC_ERROR).not.toMatch(/google|gemini|agentrouter|model/i);
  });
});
