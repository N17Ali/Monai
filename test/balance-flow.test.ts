import { describe, expect, it } from "vitest";
import type { Transaction } from "@shared/contracts/transaction";
import { buildBalanceFlow, formatAxisToman, formatCompactToman, formatExactToman, monthlyTotals } from "@/features/transactions/balance-flow";
import { summarizeBalances, withLegacyBalances } from "@shared/parsing/balance";

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(), source: "manual", status: "verified", kind: "expense", amountRial: 100000,
  occurredAt: "2024-05-22T20:00:00.000Z", sourceDateText: null, dateWasInferred: false,
  bankId: "tejarat", accountId: "account-1", balanceAfterRial: 900000, bankDescription: "خرید", userNote: null,
  categoryId: null, originalMessage: null, ...overrides,
});

describe("monthly totals", () => {
  const now = new Date("2024-05-23T10:00:00.000Z");

  it("sums income and expense only for the current Tehran Jalali month", () => {
    const totals = monthlyTotals([
      transaction({ id: "in-now", kind: "income", amountRial: 2000000, occurredAt: "2024-05-22T20:30:00.000Z" }),
      transaction({ id: "out-now", kind: "expense", amountRial: 400000, occurredAt: "2024-05-23T08:00:00.000Z" }),
      transaction({ id: "in-last-month", kind: "income", amountRial: 9000000, occurredAt: "2024-04-20T10:00:00.000Z" }),
      transaction({ id: "transfer", kind: "transfer_in", amountRial: 500000, occurredAt: "2024-05-23T09:00:00.000Z" }),
    ], now);
    expect(totals).toEqual({ incomeRial: 2500000, expenseRial: 400000, netRial: 2100000 });
  });

  it("excludes days that fall in the previous Jalali month even mid-week", () => {
    const totals = monthlyTotals([
      transaction({ id: "late-night", kind: "income", amountRial: 100000, occurredAt: "2024-05-20T20:00:00.000Z" }),
    ], now);
    expect(totals.incomeRial).toBe(0);
  });
});

describe("balance flow", () => {
  it("shows cumulative balances across accounts by Tehran-local Jalali day", () => {
    const points = buildBalanceFlow([
      transaction({ id: "a1", accountId: "account-1", balanceAfterRial: 900000, occurredAt: "2024-05-22T20:30:00.000Z" }),
      transaction({ id: "a2", accountId: "account-2", balanceAfterRial: 2500000, occurredAt: "2024-05-22T21:00:00.000Z" }),
      transaction({ id: "a3", accountId: "account-1", balanceAfterRial: 800000, occurredAt: "2024-05-24T20:00:00.000Z" }),
    ]);
    expect(points).toMatchObject([
      { date: "1403/03/03", cumulativeRial: 3400000 },
      { date: "1403/03/04", cumulativeRial: 3300000 },
    ]);
  });

  it("uses each account's closing balance for the day, regardless of input order", () => {
    // The API returns transactions newest-first; the latest instant of each
    // account+day must win, not the last-iterated row.
    const points = buildBalanceFlow([
      transaction({ id: "evening", accountId: "account-1", balanceAfterRial: 500000, occurredAt: "2024-05-22T18:30:00.000Z" }),
      transaction({ id: "morning", accountId: "account-1", balanceAfterRial: 900000, occurredAt: "2024-05-22T08:00:00.000Z" }),
    ]);
    expect(points).toMatchObject([{ date: "1403/03/02", cumulativeRial: 500000, netRial: 0 }]);
  });

  it("reports zero daily change for the first day and day-over-day diffs after that", () => {
    const points = buildBalanceFlow([
      transaction({ id: "d2", accountId: "a", balanceAfterRial: 700000, occurredAt: "2024-05-24T20:00:00.000Z" }),
      transaction({ id: "d1", accountId: "a", balanceAfterRial: 500000, occurredAt: "2024-05-22T20:00:00.000Z" }),
    ]);
    expect(points).toMatchObject([
      { date: "1403/03/02", cumulativeRial: 500000, netRial: 0 },
      { date: "1403/03/04", cumulativeRial: 700000, netRial: 200000 },
    ]);
  });

  it("never creates phantom accounts for transactions without an accountId", () => {
    // Two balance snapshots with no account identity must collapse into a
    // single "unknown" account (latest balance wins), exactly like the chat's
    // balance summary — not one phantom account per transaction.
    const points = buildBalanceFlow([
      transaction({ id: "u-early", accountId: null, bankId: null, balanceAfterRial: 1000000, occurredAt: "2024-05-22T10:00:00.000Z" }),
      transaction({ id: "u-late", accountId: null, bankId: null, balanceAfterRial: 3000000, occurredAt: "2024-05-22T18:00:00.000Z" }),
    ]);
    expect(points).toMatchObject([{ cumulativeRial: 3000000, netRial: 0 }]);
  });

  it("recovers missing balances by re-parsing the original SMS", () => {
    // Same recovery the chat applies via withLegacyBalances: a stored-null
    // balance that the SMS still contains must be used by the chart too.
    const points = buildBalanceFlow([
      transaction({ id: "legacy", accountId: "a", balanceAfterRial: null, originalMessage: "بانک تجارت برداشت 50,000 ریال مانده:500,000 ریال", occurredAt: "2024-05-22T20:00:00.000Z" }),
    ]);
    expect(points).toMatchObject([{ cumulativeRial: 500000, netRial: 0 }]);
  });

  it("agrees with the chat balance summary total", () => {
    const input = [
      transaction({ id: "known", accountId: "300421666097", balanceAfterRial: 400000000, occurredAt: "2024-05-24T20:00:00.000Z" }),
      transaction({ id: "unknown-1", accountId: null, bankId: null, balanceAfterRial: 55881234, occurredAt: "2024-05-22T10:00:00.000Z" }),
      transaction({ id: "unknown-2", accountId: null, bankId: null, balanceAfterRial: 76881234, occurredAt: "2024-05-23T10:00:00.000Z" }),
    ];
    const modelTotal = summarizeBalances(withLegacyBalances(input)).totalRial;
    const chartTotal = buildBalanceFlow(input).at(-1)?.cumulativeRial;
    expect(chartTotal).toBe(modelTotal);
  });

  it("formats compact toman amounts with Persian units", () => {
    expect(formatCompactToman(450000)).toBe("۴۵ هزار تومان");
    expect(formatCompactToman(23000000)).toBe("۲٫۳ میلیون تومان");
    expect(formatCompactToman(-12000000000)).toBe("−۱٫۲ میلیارد تومان");
  });

  it("formats exact toman amounts without abbreviation or rounding", () => {
    // The home "مانده کل" must show the real cumulative balance, not a rounded
    // compact figure (۴۸٫۳ میلیون) that hides the actual amount.
    expect(formatExactToman(482892359)).toBe("۴۸٬۲۸۹٬۲۳۵٫۹ تومان");
    expect(formatExactToman(450000)).toBe("۴۵٬۰۰۰ تومان");
    expect(formatExactToman(-12000000000)).toBe("−۱٬۲۰۰٬۰۰۰٬۰۰۰ تومان");
  });

  it("formats short axis labels without the toman suffix", () => {
    expect(formatAxisToman(0)).toBe("۰");
    expect(formatAxisToman(450000)).toBe("۴۵ هزار");
    expect(formatAxisToman(625865000)).toBe("۶۲٫۶ میلیون");
    expect(formatAxisToman(-12000000000)).toBe("−۱٫۲ میلیارد");
  });
});
