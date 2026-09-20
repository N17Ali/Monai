import { describe, expect, it } from "vitest";
import type { NewTransactionDraft } from "../src/features/transactions/transaction.storage";
import { createMemoryTransactionStorage } from "../src/features/transactions/transaction.memory";

// The suite asserts the interface both adapters must uphold: dedup by
// fingerprint, a needs_review gate on verify/reject, and keyset page ordering.
function draft(id: string, overrides: Partial<NewTransactionDraft> = {}): NewTransactionDraft {
  return {
    id,
    source: "clipboard",
    kind: "expense",
    amountRial: 450000,
    occurredAt: "2024-05-22T20:00:00.000Z",
    sourceDateText: null,
    dateWasInferred: false,
    bankId: "tejarat",
    accountId: null,
    balanceAfterRial: null,
    originalMessage: `پیام ${id}`,
    fingerprint: `fp-${id}`,
    extractionMeta: JSON.stringify({ parser: "bank_rules_v2" }),
    ...overrides,
  };
}

function manual(id: string, occurredAt: string) {
  return { id, source: "manual" as const, kind: "expense" as const, amountRial: 100000, occurredAt, userNote: null, createdAt: occurredAt, verifiedAt: occurredAt };
}

describe("transaction storage conformance: memory", () => {
  it("creates a draft and lists it as needs_review", async () => {
    const storage = createMemoryTransactionStorage("u1");
    expect(await storage.createDraft(draft("d1"))).toEqual({ status: "created", id: "d1" });
    const [listed] = await storage.listDrafts();
    expect(listed).toMatchObject({ id: "d1", status: "needs_review", amountRial: 450000, originalMessage: "پیام d1" });
    expect(await storage.listVerified()).toEqual([]);
  });

  it("dedupes by fingerprint and keeps only the first draft", async () => {
    const storage = createMemoryTransactionStorage("u1");
    await storage.createDraft(draft("d1", { fingerprint: "same" }));
    expect(await storage.createDraft(draft("d2", { fingerprint: "same" }))).toEqual({ status: "duplicate" });
    expect((await storage.listDrafts()).map((item) => item.id)).toEqual(["d1"]);
  });

  it("verifies a draft, applies the correction, and reports a miss", async () => {
    const storage = createMemoryTransactionStorage("u1");
    await storage.createDraft(draft("d1"));
    const found = await storage.verify("d1", { kind: "income", amountRial: 9000, userNote: "حقوق", occurredAt: "2024-06-01T00:00:00.000Z" });
    expect(found).toBe(true);
    expect(await storage.listDrafts()).toEqual([]);
    expect(await storage.listVerified()).toMatchObject([{ id: "d1", status: "verified", kind: "income", amountRial: 9000, userNote: "حقوق", occurredAt: "2024-06-01T00:00:00.000Z" }]);
    expect(await storage.verify("d1", { kind: "income", amountRial: 9000, userNote: null })).toBe(false);
  });

  it("rejects only a needs_review draft and never verifies it", async () => {
    const storage = createMemoryTransactionStorage("u1");
    await storage.createDraft(draft("d1"));
    expect(await storage.reject("d1")).toBe(true);
    expect(await storage.listDrafts()).toEqual([]);
    expect(await storage.listVerified()).toEqual([]);
    expect(await storage.reject("d1")).toBe(false);
  });

  it("pages verified transactions in occurredAt DESC, id DESC order", async () => {
    const storage = createMemoryTransactionStorage("u1");
    await storage.createVerified(manual("a", "2024-05-01T10:00:00.000Z"));
    await storage.createVerified(manual("b", "2024-05-03T10:00:00.000Z"));
    await storage.createVerified(manual("c", "2024-05-02T10:00:00.000Z"));

    const first = await storage.listVerifiedPage({ limit: 2 });
    expect(first.map((item) => item.id)).toEqual(["b", "c"]);
    const last = first.at(-1);
    const second = await storage.listVerifiedPage({ limit: 2, after: { occurredAt: last?.occurredAt ?? "", id: last?.id ?? "" } });
    expect(second.map((item) => item.id)).toEqual(["a"]);
  });

  it("stores a directly verified transaction with its optional fields defaulted", async () => {
    const storage = createMemoryTransactionStorage("u1");
    await storage.createVerified(manual("m1", "2024-05-01T10:00:00.000Z"));
    expect(await storage.listVerified()).toMatchObject([
      { id: "m1", source: "manual", status: "verified", kind: "expense", amountRial: 100000, sourceDateText: null, bankId: null, originalMessage: null },
    ]);
  });

  it("updates only a verified transaction", async () => {
    const storage = createMemoryTransactionStorage("u1");
    await storage.createVerified(manual("m1", "2024-05-01T10:00:00.000Z"));

    expect(await storage.updateVerified("m1", { kind: "income", amountRial: 900000, userNote: "حقوق", occurredAt: "2024-05-02T10:00:00.000Z" })).toBe(true);
    expect(await storage.listVerified()).toMatchObject([{ id: "m1", kind: "income", amountRial: 900000, userNote: "حقوق", occurredAt: "2024-05-02T10:00:00.000Z" }]);

    await storage.createDraft(draft("d1"));
    expect(await storage.updateVerified("d1", { kind: "income", amountRial: 900000, userNote: null, occurredAt: "2024-05-02T10:00:00.000Z" })).toBe(false);
    expect(await storage.updateVerified("missing", { kind: "income", amountRial: 900000, userNote: null, occurredAt: "2024-05-02T10:00:00.000Z" })).toBe(false);
  });

  it("deletes verified transactions and releases draft fingerprints", async () => {
    const storage = createMemoryTransactionStorage("u1");
    await storage.createVerified(manual("m1", "2024-05-01T10:00:00.000Z"));
    expect(await storage.deleteVerified("m1")).toBe(true);
    expect(await storage.listVerified()).toEqual([]);
    expect(await storage.deleteVerified("m1")).toBe(false);

    await storage.createDraft(draft("d1", { fingerprint: "reusable" }));
    expect(await storage.deleteVerified("d1")).toBe(false);
    expect(await storage.verify("d1", { kind: "expense", amountRial: 100, userNote: null })).toBe(true);
    expect(await storage.deleteVerified("d1")).toBe(true);
    expect(await storage.createDraft(draft("d2", { fingerprint: "reusable" }))).toEqual({ status: "created", id: "d2" });
  });
});
