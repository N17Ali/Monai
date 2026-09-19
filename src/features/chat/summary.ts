import { tool } from "ai";
import { z } from "zod";
import type { Transaction } from "../../../shared/contracts/transaction";
import { kindLabels, transactionDirection } from "../../../shared/contracts/transaction";
import { formatJalaliDay, jalaliMonthName, jalaliWeekEnd, jalaliWeekStart } from "../../../shared/parsing/jalali";
import { tehranJalaliDay } from "../../../shared/parsing/tehran-day";
import { rialToToman } from "../../../shared/money";

export type SummaryTransaction = Pick<Transaction, "kind" | "amountRial" | "occurredAt" | "userNote">;

export type SummaryQuery = {
  fromJalali?: string;
  toJalali?: string;
  direction?: "in" | "out";
  noteContains?: string;
  groupBy?: "day" | "week" | "month" | "kind" | "note" | "none";
  groups?: Array<{ label: string; notes: string[] }>;
  breakdown?: "day" | "week" | "month" | "none";
};

export type SummaryPeriod = { period: string; totalToman: number };

export type SummaryGroup = {
  label: string;
  totalToman: number;
  count: number;
  byPeriod?: SummaryPeriod[];
};

export type SummaryResult = {
  totalToman: number;
  count: number;
  groups: SummaryGroup[];
  ungrouped?: { count: number; totalToman: number };
  unknownNotes?: string[];
};

export type NoteSummary = {
  note: string | null;
  count: number;
  totalToman: number;
  firstJalali: string;
  lastJalali: string;
};

const UNLABELED = "بدون یادداشت";

// Tehran-local day key "YYYY/MM/DD" — the same day rule the balance chart and
// the chat context use, so a transaction never changes day between surfaces.
// Zero-padded parts make the keys directly comparable as strings (and against
// the fromJalali/toJalali tool inputs).
function dayKey(item: SummaryTransaction) {
  return formatJalaliDay(tehranJalaliDay(item.occurredAt));
}

function monthKeys(day: string) {
  return { sortKey: day.slice(0, 7), label: `${jalaliMonthName(Number(day.split("/")[1]))} ${day.split("/")[0]}` };
}

function weekKeys(day: string) {
  const [jy, jm, jd] = day.split("/").map(Number);
  const start = jalaliWeekStart(jy, jm, jd);
  const end = jalaliWeekEnd(jy, jm, jd);
  return { sortKey: formatJalaliDay(start), label: `${formatJalaliDay(start)} تا ${formatJalaliDay(end)}` };
}

function periodKeys(day: string, breakdown: "day" | "week" | "month") {
  if (breakdown === "day") return { sortKey: day, label: day };
  if (breakdown === "week") return weekKeys(day);
  return monthKeys(day);
}

function groupKeys(item: SummaryTransaction, day: string, groupBy: NonNullable<SummaryQuery["groupBy"]>) {
  switch (groupBy) {
    case "day":
      return { sortKey: day, label: day };
    case "week":
      return weekKeys(day);
    case "month":
      return monthKeys(day);
    case "kind":
      return { sortKey: kindLabels[item.kind], label: kindLabels[item.kind] };
    case "note":
      return { sortKey: item.userNote ?? UNLABELED, label: item.userNote ?? UNLABELED };
    default:
      return { sortKey: "", label: "همه" };
  }
}

function matchesFilters(item: SummaryTransaction, query: SummaryQuery) {
  if (query.direction && transactionDirection(item.kind) !== query.direction) return false;
  if (query.noteContains && !(item.userNote ?? "").includes(query.noteContains)) return false;
  const day = dayKey(item);
  if (query.fromJalali && day < query.fromJalali) return false;
  if (query.toJalali && day > query.toJalali) return false;
  return true;
}

const byTotalThenLabel = (a: { totalToman: number; label: string }, b: { totalToman: number; label: string }) =>
  b.totalToman - a.totalToman || a.label.localeCompare(b.label, "fa");

function accumulate(
  items: SummaryTransaction[],
  breakdown: "day" | "week" | "month" | "none" = "none",
): { totalToman: number; count: number; byPeriod?: SummaryPeriod[] } {
  const totalToman = rialToToman(items.reduce((sum, item) => sum + item.amountRial, 0));
  const base = { totalToman, count: items.length };
  if (breakdown === "none" || items.length === 0) return base;
  const periods = new Map<string, { label: string; totalRial: number }>();
  for (const item of items) {
    const { sortKey, label } = periodKeys(dayKey(item), breakdown);
    const period = periods.get(sortKey) ?? { label, totalRial: 0 };
    period.totalRial += item.amountRial;
    periods.set(sortKey, period);
  }
  const byPeriod = [...periods.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, { label, totalRial }]) => ({ period: label, totalToman: rialToToman(totalRial) }));
  return { ...base, byPeriod };
}

export function summarizeTransactions(transactions: SummaryTransaction[], query: SummaryQuery): SummaryResult {
  const filtered = transactions.filter((item) => matchesFilters(item, query));
  const total = accumulate(filtered);

  // Model-supplied semantic classification: the model decides which notes belong
  // to which label; everything below is arithmetic done in code.
  if (query.groups && query.groups.length > 0) {
    const noteToGroup = new Map<string, string>();
    for (const group of query.groups) {
      for (const note of group.notes) {
        if (!noteToGroup.has(note)) noteToGroup.set(note, group.label);
      }
    }
    const matched = new Map<string, SummaryTransaction[]>();
    const ungrouped: SummaryTransaction[] = [];
    const matchedNotes = new Set<string>();
    for (const item of filtered) {
      const note = item.userNote;
      const label = note == null ? undefined : noteToGroup.get(note);
      if (note != null && label != null) {
        matchedNotes.add(note);
        const bucket = matched.get(label) ?? [];
        bucket.push(item);
        matched.set(label, bucket);
      } else {
        ungrouped.push(item);
      }
    }
    const unknownNotes = [...noteToGroup.keys()].filter((note) => !matchedNotes.has(note));
    const groups: SummaryGroup[] = [...matched.entries()]
      .map(([label, items]) => ({ label, ...accumulate(items, query.breakdown) }))
      .sort(byTotalThenLabel);
    const result: SummaryResult = { ...total, groups };
    if (ungrouped.length > 0) result.ungrouped = accumulate(ungrouped);
    if (unknownNotes.length > 0) result.unknownNotes = unknownNotes;
    return result;
  }

  const groupBy = query.groupBy ?? "none";
  if (groupBy === "none") return { ...total, groups: [] };

  const buckets = new Map<string, { label: string; items: SummaryTransaction[] }>();
  for (const item of filtered) {
    const { sortKey, label } = groupKeys(item, dayKey(item), groupBy);
    const bucket = buckets.get(sortKey) ?? { label, items: [] };
    bucket.items.push(item);
    buckets.set(sortKey, bucket);
  }
  // Time groups sort chronologically by their numeric sortKey (a month label
  // like «شهریور 1405» does not sort chronologically as Persian text); kind and
  // note groups sort by total descending.
  const timeGrouping = groupBy === "day" || groupBy === "week" || groupBy === "month";
  const rows = [...buckets.entries()].map(([sortKey, bucket]) => ({ sortKey, label: bucket.label, ...accumulate(bucket.items, query.breakdown) }));
  rows.sort(timeGrouping ? (a, b) => a.sortKey.localeCompare(b.sortKey) : byTotalThenLabel);
  const groups: SummaryGroup[] = rows.map(({ label, totalToman, count, byPeriod }) => ({ label, totalToman, count, byPeriod }));
  return { ...total, groups };
}

export function listNotes(
  transactions: SummaryTransaction[],
  query: Pick<SummaryQuery, "fromJalali" | "toJalali" | "direction">,
): { notes: NoteSummary[] } {
  const byNote = new Map<string | null, { items: SummaryTransaction[]; days: Set<string> }>();
  for (const item of transactions.filter((entry) => matchesFilters(entry, query))) {
    const bucket = byNote.get(item.userNote) ?? { items: [], days: new Set<string>() };
    bucket.items.push(item);
    bucket.days.add(dayKey(item));
    byNote.set(item.userNote, bucket);
  }
  const notes: NoteSummary[] = [...byNote.entries()].map(([note, { items, days }]) => {
    const sortedDays = [...days].sort();
    return {
      note,
      count: items.length,
      totalToman: rialToToman(items.reduce((sum, item) => sum + item.amountRial, 0)),
      firstJalali: sortedDays[0]!,
      lastJalali: sortedDays.at(-1)!,
    };
  });
  notes.sort((a, b) => b.totalToman - a.totalToman || (a.note ?? "").localeCompare(b.note ?? "", "fa"));
  return { notes };
}

const jalaliDaySchema = z
  .string()
  .regex(/^\d{4}\/\d{2}\/\d{2}$/, "Jalali day must be formatted YYYY/MM/DD, e.g. 1405/06/21");

export function createSummarizeTool(transactions: SummaryTransaction[]) {
  return tool({
    description:
      "Sum, count, and group the user's verified transactions deterministically. ALWAYS call this tool for any total, count, grouped subtotal, or period comparison — never compute sums yourself. Filters: fromJalali/toJalali (inclusive Jalali days, YYYY/MM/DD), direction ('out' = spending: expense/fee/cash_withdrawal; 'in' = money in: income/refund; transfers are excluded from both), noteContains (substring of the user's note). Deterministic groupings via groupBy: 'day' | 'week' (Saturday to Friday) | 'month' | 'kind' | 'note' | 'none'. For semantic categories (transport, food, health...), first call list_notes for the range, then pass groups: [{label, notes}] with the exact note strings you saw — sums are computed per label, anything unmatched is returned as 'ungrouped', and notes that matched nothing are returned as 'unknownNotes' so you can retry. breakdown: 'day' | 'week' | 'month' | 'none' adds a per-period split inside each group (e.g. month-over-month comparison of one category in a single call).",
    inputSchema: z.object({
      fromJalali: jalaliDaySchema.optional(),
      toJalali: jalaliDaySchema.optional(),
      direction: z.enum(["in", "out"]).optional(),
      noteContains: z.string().min(1).optional(),
      groupBy: z.enum(["day", "week", "month", "kind", "note", "none"]).optional(),
      groups: z.array(z.object({ label: z.string().min(1), notes: z.array(z.string().min(1)).min(1) })).min(1).optional(),
      breakdown: z.enum(["day", "week", "month", "none"]).optional(),
    }),
    execute: async (query) => summarizeTransactions(transactions, query),
  });
}

export function createListNotesTool(transactions: SummaryTransaction[]) {
  return tool({
    description:
      "List every distinct note the user's verified transactions carry for a range, each with its count, total in Toman, and first/last Jalali day — the discovery source for building semantic groups for summarize_transactions, and a direct answer for 'what was my biggest expense'. Sorted by total descending; transactions without a note appear as note: null.",
    inputSchema: z.object({
      fromJalali: jalaliDaySchema.optional(),
      toJalali: jalaliDaySchema.optional(),
      direction: z.enum(["in", "out"]).optional(),
    }),
    execute: async (query) => listNotes(transactions, query),
  });
}
