import { describe, expect, it } from "vitest";
import { enrichmentUpdateSchema } from "../shared/contracts/transaction";

describe("enrichment update contract", () => {
  it("accepts kind, amount, and note without a date", () => {
    expect(enrichmentUpdateSchema.parse({ kind: "expense", amountToman: 45000, note: "خرید" })).toEqual({ kind: "expense", amountToman: 45000, note: "خرید" });
  });

  it("accepts an edited occurredAt instant", () => {
    const parsed = enrichmentUpdateSchema.parse({ kind: "expense", amountToman: 45000, note: "", occurredAt: "2024-05-22T20:30:00.000Z" });
    expect(parsed.occurredAt).toBe("2024-05-22T20:30:00.000Z");
  });

  it("rejects a malformed occurredAt value", () => {
    expect(enrichmentUpdateSchema.safeParse({ kind: "expense", amountToman: 45000, note: "", occurredAt: "tomorrow" }).success).toBe(false);
  });
});
