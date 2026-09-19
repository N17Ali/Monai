import { describe, expect, it } from "vitest";
import { formatJalaliDay, jalaliWeekStart, jalaliWeekdayName } from "../shared/parsing/jalali";
import { createListNotesTool, createSummarizeTool, listNotes, summarizeTransactions, type SummaryTransaction } from "../src/features/chat/summary";

function tx(overrides: Partial<SummaryTransaction>): SummaryTransaction {
  return { kind: "expense", amountRial: 1000, occurredAt: "2026-09-13T08:00:00.000Z", userNote: null, ...overrides };
}

// 2026-09-13T08:00Z is 11:30 Tehran on 1405/06/22 (Sunday). Neighbouring days:
// 1405/06/20 = Friday 2026-09-11, 1405/06/21 = Saturday 2026-09-12,
// 1405/06/27 = Friday 2026-09-18, 1405/06/14 = Saturday 2026-09-05,
// 1405/05/15 = 2026-08-06.
const sunday = "2026-09-13T08:00:00.000Z";
const saturday = "2026-09-12T08:00:00.000Z";
const friday = "2026-09-11T08:00:00.000Z";
const nextFriday = "2026-09-18T08:00:00.000Z";
const previousMonth = "2026-08-06T08:00:00.000Z";

describe("week bucketing (Jalali weeks start on Saturday)", () => {
  it("exposes numeric shared helpers for week boundaries and weekday names", () => {
    expect(formatJalaliDay(jalaliWeekStart(1405, 6, 22))).toBe("1405/06/21");
    expect(jalaliWeekdayName(1405, 6, 22)).toBe("یکشنبه");
  });

  it("puts a Sunday in the week that starts the previous Saturday", () => {
    const result = summarizeTransactions([tx({ occurredAt: sunday })], { groupBy: "week" });
    expect(result.groups.map((group) => group.label)).toEqual(["1405/06/21 تا 1405/06/27"]);
  });

  it("keeps Saturday and Sunday of the same week together", () => {
    const result = summarizeTransactions([tx({ occurredAt: saturday, amountRial: 2000 }), tx({ occurredAt: sunday, amountRial: 3000 })], { groupBy: "week" });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.label).toBe("1405/06/21 تا 1405/06/27");
    expect(result.groups[0]?.totalToman).toBe(500);
    expect(result.groups[0]?.count).toBe(2);
  });

  it("ends the week on Friday, so a Friday belongs to the week that started six days earlier", () => {
    const result = summarizeTransactions([tx({ occurredAt: friday })], { groupBy: "week" });
    expect(result.groups.map((group) => group.label)).toEqual(["1405/06/14 تا 1405/06/20"]);
  });

  it("separates two consecutive Saturday-to-Friday weeks", () => {
    const result = summarizeTransactions([tx({ occurredAt: friday }), tx({ occurredAt: nextFriday })], { groupBy: "week" });
    expect(result.groups.map((group) => group.label)).toEqual(["1405/06/14 تا 1405/06/20", "1405/06/21 تا 1405/06/27"]);
  });
});

describe("range and direction filters", () => {
  it("treats fromJalali and toJalali as inclusive day bounds", () => {
    const result = summarizeTransactions(
      [tx({ occurredAt: friday }), tx({ occurredAt: saturday }), tx({ occurredAt: sunday }), tx({ occurredAt: nextFriday })],
      { fromJalali: "1405/06/21", toJalali: "1405/06/21" },
    );
    expect(result.count).toBe(1);
    expect(result.totalToman).toBe(100);
  });

  it("counts only out kinds as spending and excludes transfers", () => {
    const result = summarizeTransactions(
      [
        tx({ kind: "expense", amountRial: 10_000 }),
        tx({ kind: "fee", amountRial: 2_000 }),
        tx({ kind: "cash_withdrawal", amountRial: 5_000 }),
        tx({ kind: "transfer_out", amountRial: 100_000 }),
        tx({ kind: "income", amountRial: 50_000 }),
      ],
      { direction: "out" },
    );
    expect(result.totalToman).toBe(1_700);
    expect(result.count).toBe(3);
  });

  it("counts income and refunds as money in", () => {
    const result = summarizeTransactions(
      [tx({ kind: "income", amountRial: 50_000 }), tx({ kind: "refund", amountRial: 3_000 }), tx({ kind: "expense", amountRial: 4_000 })],
      { direction: "in" },
    );
    expect(result.totalToman).toBe(5_300);
    expect(result.count).toBe(2);
  });

  it("filters by a substring of the user's note", () => {
    const result = summarizeTransactions(
      [tx({ userNote: "اسنپ به دکتر", amountRial: 122_000 }), tx({ userNote: "خرید میوه", amountRial: 2_498_900 })],
      { noteContains: "اسنپ" },
    );
    expect(result.count).toBe(1);
    expect(result.totalToman).toBe(12_200);
  });
});

describe("deterministic groupings", () => {
  it("labels note groups with the user's note and بدون یادداشت for null", () => {
    const result = summarizeTransactions(
      [tx({ userNote: "خرید میوه", amountRial: 2_498_900 }), tx({ userNote: null, amountRial: 310_000 }), tx({ userNote: "خرید میوه", amountRial: 100_000 })],
      { groupBy: "note" },
    );
    expect(result.groups.map((group) => group.label)).toEqual(["خرید میوه", "بدون یادداشت"]);
    expect(result.groups[0]?.totalToman).toBe(259_890);
    expect(result.groups[1]?.totalToman).toBe(31_000);
  });

  it("labels month groups with the Persian month name and sorts chronologically", () => {
    const result = summarizeTransactions([tx({ occurredAt: previousMonth, amountRial: 8_000 }), tx({ amountRial: 5_000 })], { groupBy: "month" });
    expect(result.groups.map((group) => group.label)).toEqual(["مرداد 1405", "شهریور 1405"]);
  });

  it("returns a single overall total when no grouping is requested", () => {
    const result = summarizeTransactions([tx({ amountRial: 4_180 }), tx({ amountRial: 1_220 })], {});
    expect(result.groups).toEqual([]);
    expect(result.totalToman).toBe(540);
    expect(result.count).toBe(2);
  });

  it("returns an empty result for a range with no transactions", () => {
    const result = summarizeTransactions([tx({ occurredAt: sunday })], { fromJalali: "1404/01/01", toJalali: "1404/01/31" });
    expect(result.totalToman).toBe(0);
    expect(result.count).toBe(0);
    expect(result.groups).toEqual([]);
  });
});

describe("model-supplied semantic groups", () => {
  const transactions = [
    tx({ userNote: "اسنپ به دکتر", amountRial: 122_000 }),
    tx({ userNote: "اسنپ بازگشت به شرکت", amountRial: 160_000 }),
    tx({ userNote: "هزینه ویزیت دکتر", amountRial: 8_511_000 }),
    tx({ userNote: "خرید دارو", amountRial: 3_932_650 }),
    tx({ userNote: null, amountRial: 310_000 }),
  ];

  it("sums per label and reports the ungrouped remainder so totals reconcile", () => {
    const result = summarizeTransactions(transactions, {
      groups: [
        { label: "حمل‌ونقل", notes: ["اسنپ به دکتر", "اسنپ بازگشت به شرکت"] },
        { label: "درمان", notes: ["هزینه ویزیت دکتر", "خرید دارو"] },
      ],
    });
    expect(result.groups.map((group) => group.label)).toEqual(["درمان", "حمل‌ونقل"]);
    expect(result.groups.find((group) => group.label === "حمل‌ونقل")?.totalToman).toBe(28_200);
    expect(result.groups.find((group) => group.label === "درمان")?.totalToman).toBe(1_244_365);
    expect(result.ungrouped).toEqual({ count: 1, totalToman: 31_000 });
    const groupSum = result.groups.reduce((sum, group) => sum + group.totalToman, 0);
    expect(groupSum + (result.ungrouped?.totalToman ?? 0)).toBe(result.totalToman);
  });

  it("echoes notes that matched nothing back as unknownNotes", () => {
    const result = summarizeTransactions(transactions, { groups: [{ label: "خرید دارو", notes: ["خرید دارو", "خرید دارو اشتباهی"] }] });
    expect(result.unknownNotes).toEqual(["خرید دارو اشتباهی"]);
    expect(result.groups[0]?.totalToman).toBe(393_265);
  });

  it("respects range and direction filters alongside the classification", () => {
    const result = summarizeTransactions(
      [...transactions, tx({ occurredAt: previousMonth, userNote: "خرید دارو", amountRial: 100_000 })],
      { fromJalali: "1405/06/01", groups: [{ label: "درمان", notes: ["خرید دارو"] }] },
    );
    expect(result.groups[0]?.count).toBe(1);
    expect(result.groups[0]?.totalToman).toBe(393_265);
  });
});

describe("breakdown", () => {
  it("cross-cuts semantic groups into a per-month matrix in one call", () => {
    const result = summarizeTransactions(
      [
        tx({ occurredAt: previousMonth, userNote: "اسنپ به دکتر", amountRial: 320_000 }),
        tx({ userNote: "اسنپ بازگشت به شرکت", amountRial: 290_000 }),
      ],
      { groups: [{ label: "حمل‌ونقل", notes: ["اسنپ به دکتر", "اسنپ بازگشت به شرکت"] }], breakdown: "month" },
    );
    expect(result.groups[0]?.byPeriod).toEqual([
      { period: "مرداد 1405", totalToman: 32_000 },
      { period: "شهریور 1405", totalToman: 29_000 },
    ]);
    expect(result.groups[0]?.totalToman).toBe(61_000);
  });

  it("splits a kind grouping by week inside each group", () => {
    const result = summarizeTransactions([tx({ occurredAt: friday }), tx({ occurredAt: sunday })], { groupBy: "kind", breakdown: "week" });
    expect(result.groups[0]?.byPeriod).toEqual([{ period: "1405/06/14 تا 1405/06/20", totalToman: 100 }, { period: "1405/06/21 تا 1405/06/27", totalToman: 100 }]);
  });
});

describe("listNotes", () => {
  it("dedupes notes with count, total, and first/last Jalali day, sorted by total", () => {
    const result = listNotes(
      [
        tx({ userNote: "اسنپ به دکتر", amountRial: 122_000, occurredAt: sunday }),
        tx({ userNote: "اسنپ به دکتر", amountRial: 100_000, occurredAt: saturday }),
        tx({ userNote: "هزینه ویزیت دکتر", amountRial: 8_511_000, occurredAt: friday }),
        tx({ userNote: null, amountRial: 310_000, occurredAt: nextFriday }),
      ],
      {},
    );
    expect(result.notes).toEqual([
      { note: "هزینه ویزیت دکتر", count: 1, totalToman: 851_100, firstJalali: "1405/06/20", lastJalali: "1405/06/20" },
      { note: null, count: 1, totalToman: 31_000, firstJalali: "1405/06/27", lastJalali: "1405/06/27" },
      { note: "اسنپ به دکتر", count: 2, totalToman: 22_200, firstJalali: "1405/06/21", lastJalali: "1405/06/22" },
    ]);
  });

  it("applies the same range and direction filters as summarize", () => {
    const result = listNotes(
      [
        tx({ userNote: "خرید دارو", amountRial: 100_000 }),
        tx({ occurredAt: previousMonth, userNote: "خرید قدیمی", amountRial: 100_000, kind: "income" }),
      ],
      { direction: "out", fromJalali: "1405/06/01" },
    );
    expect(result.notes.map((note) => note.note)).toEqual(["خرید دارو"]);
  });
});

describe("tool bindings", () => {
  it("summarize_transactions executes over the captured transactions", async () => {
    const summarize = createSummarizeTool([tx({ amountRial: 418_000 })]) as unknown as {
      execute: (input: Record<string, unknown>) => Promise<{ totalToman: number; count: number }>;
    };
    const result = await summarize.execute({ direction: "out" });
    expect(result).toEqual({ totalToman: 41_800, count: 1, groups: [] });
  });

  it("list_notes executes over the captured transactions", async () => {
    const list = createListNotesTool([tx({ userNote: "خرید میوه", amountRial: 2_498_900 })]) as unknown as {
      execute: (input: Record<string, unknown>) => Promise<{ notes: Array<{ note: string | null; totalToman: number }> }>;
    };
    const result = await list.execute({});
    expect(result.notes).toEqual([{ note: "خرید میوه", count: 1, totalToman: 249_890, firstJalali: "1405/06/22", lastJalali: "1405/06/22" }]);
  });
});
