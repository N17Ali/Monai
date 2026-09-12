import { describe, expect, it } from "vitest";
import { summarizeBalances, withLegacyBalances } from "../shared/parsing/balance";
import { buildSystemPrompt } from "../src/features/chat/system-prompt";
import type { Transaction } from "../shared/contracts/transaction";

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    source: "clipboard",
    status: "verified",
    kind: "expense",
    amountRial: 1000,
    occurredAt: "2026-09-01T00:00:00.000Z",
    sourceDateText: null,
    dateWasInferred: false,
    bankId: null,
    accountId: null,
    balanceAfterRial: null,
    bankDescription: null,
    userNote: null,
    categoryId: null,
    originalMessage: null,
    ...overrides,
  };
}

describe("account balance summary", () => {
  it("keeps only the latest balance per account and totals them", () => {
    const result = summarizeBalances([
      makeTransaction({ bankId: "blu", balanceAfterRial: 900_000, occurredAt: "2026-09-03T08:00:00.000Z" }),
      makeTransaction({ bankId: "blu", balanceAfterRial: 1_200_000, occurredAt: "2026-09-01T08:00:00.000Z" }),
      makeTransaction({ accountId: "300412345678", balanceAfterRial: 889_123_789, occurredAt: "2026-08-27T11:05:00.000Z" }),
    ]);
    expect(result.accounts).toHaveLength(2);
    expect(result.totalRial).toBe(900_000 + 889_123_789);
    expect(result.accounts.map((account) => account.account)).toEqual(["بلو", "حساب 300412345678"]);
  });

  it("labels accounts by bank and account number together when both are known", () => {
    const result = summarizeBalances([
      makeTransaction({ bankId: "mellat", accountId: "5352013699", balanceAfterRial: 510_123, occurredAt: "2026-08-02T08:00:00.000Z" }),
    ]);
    expect(result.accounts[0]?.account).toBe("بانک ملت 5352013699");
  });

  it("skips transactions without a captured balance", () => {
    const result = summarizeBalances([makeTransaction({ bankId: "blu", occurredAt: "2026-09-03T08:00:00.000Z" })]);
    expect(result.accounts).toHaveLength(0);
    expect(result.totalRial).toBe(0);
  });
});

describe("legacy balance backfill", () => {
  it("re-parses the original message when the stored balance is missing", () => {
    const [item] = withLegacyBalances([
      makeTransaction({ originalMessage: "حساب5352013699\nبرداشت27,123,456\nمانده510,123\n05/05/11-11:30" }),
    ]);
    expect(item.balanceAfterRial).toBe(510123);
    expect(item.accountId).toBe("5352013699");
  });

  it("keeps stored balances and skips messages without one", () => {
    const [kept, skipped] = withLegacyBalances([
      makeTransaction({ bankId: "blu", balanceAfterRial: 900_000, originalMessage: "بلو 418,000 ریال از حساب شما پرید." }),
      makeTransaction({ originalMessage: "بلو 418,000 ریال از حساب شما پرید." }),
    ]);
    expect(kept.balanceAfterRial).toBe(900_000);
    expect(skipped.balanceAfterRial).toBeNull();
  });
});

describe("chat system prompt", () => {
  it("includes the account balances and their total", () => {
    const balances = summarizeBalances([
      makeTransaction({ bankId: "blu", balanceAfterRial: 900_000, occurredAt: "2026-09-03T08:00:00.000Z" }),
    ]);
    const prompt = buildSystemPrompt([], balances);
    expect(prompt).toContain("accountBalances");
    expect(prompt).toContain('"totalRial":900000');
    expect(prompt).toContain("Toman");
  });
});

describe("chat date localization", () => {
  it("formats transaction datetimes as Tehran-local Jalali so the model cannot read the UTC day", () => {
    const prompt = buildSystemPrompt([makeTransaction({ occurredAt: "2026-09-03T22:22:00.000Z", userNote: "خرید" })], { accounts: [], totalRial: 0 });
    expect(prompt).toContain("1405/06/13 01:52");
    expect(prompt).not.toContain("2026-09-03T22:22:00.000Z");
  });

  it("formats balance asOf as Tehran-local Jalali and keeps the totals", () => {
    const balances = summarizeBalances([makeTransaction({ bankId: "blu", balanceAfterRial: 900_000, occurredAt: "2026-09-03T22:22:00.000Z" })]);
    const prompt = buildSystemPrompt([], balances);
    expect(prompt).toContain("1405/06/13 01:52");
    expect(prompt).toContain('"totalRial":900000');
    expect(prompt).not.toContain("2026-09-03T22:22:00.000Z");
  });

  it("instructs the model to answer with Jalali dates only", () => {
    const prompt = buildSystemPrompt([], { accounts: [], totalRial: 0 });
    expect(prompt).toContain("جلالی");
    expect(prompt).toContain("Gregorian");
  });
});
