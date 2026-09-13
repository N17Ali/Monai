import type { Transaction } from "@shared/contracts/transaction";
import { transactionDirection } from "@shared/contracts/transaction";
import { rialToToman } from "@shared/money";
import { gregorianToJalali } from "@shared/parsing/jalali";
import { balanceTimeline, withLegacyBalances } from "@shared/parsing/balance";

export type BalanceFlowPoint = {
  date: string;
  label: string;
  netRial: number;
  cumulativeRial: number;
};

function dayParts(date: string) {
  const tehran = new Date(new Date(date).getTime() + 3.5 * 60 * 60 * 1000);
  return gregorianToJalali(tehran.getUTCFullYear(), tehran.getUTCMonth() + 1, tehran.getUTCDate());
}

const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

function dayLabel(date: string) {
  const [, month, day] = date.split("/").map(Number);
  return `${new Intl.NumberFormat("fa-IR").format(day)} ${monthNames[month - 1]}`;
}

export function buildBalanceFlow(transactions: Transaction[]): BalanceFlowPoint[] {
  // The day-closing fold lives in shared/parsing/balance.ts (balanceByDay), the
  // same fold the chat balance summary reads, so the chart's final point and the
  // model's total can never disagree.
  let previousTotal: number | null = null;
  return balanceTimeline(withLegacyBalances(transactions)).map((point) => {
    const netRial = previousTotal == null ? 0 : point.totalRial - previousTotal;
    previousTotal = point.totalRial;
    return { date: point.date, label: dayLabel(point.date), netRial, cumulativeRial: point.totalRial };
  });
}

export function monthlyTotals(transactions: Transaction[], now = new Date()) {
  const nowParts = dayParts(now.toISOString());
  let incomeRial = 0;
  let expenseRial = 0;
  for (const item of transactions) {
    const parts = dayParts(item.occurredAt);
    if (parts.jy !== nowParts.jy || parts.jm !== nowParts.jm) continue;
    const direction = transactionDirection(item.kind);
    if (direction === "in") incomeRial += item.amountRial;
    else if (direction === "out") expenseRial += item.amountRial;
  }
  return { incomeRial, expenseRial, netRial: incomeRial - expenseRial };
}

export function formatCompactToman(amountRial: number) {
  const amount = rialToToman(amountRial);
  const absolute = Math.abs(amount);
  const unit = absolute >= 1_000_000_000 ? [1_000_000_000, "میلیارد"] : absolute >= 1_000_000 ? [1_000_000, "میلیون"] : absolute >= 1_000 ? [1_000, "هزار"] : [1, ""];
  const value = amount / Number(unit[0]);
  const formatted = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(Math.abs(value));
  return `${amount < 0 ? "−" : ""}${formatted}${unit[1] ? ` ${unit[1]}` : ""} تومان`;
}

// Full, non-abbreviated toman amount for the home "مانده کل" summary: the
// actual cumulative balance (up to one decimal, since Rial/10 can be .x), never
// a rounded compact figure that hides the real amount.
export function formatExactToman(amountRial: number) {
  const amount = rialToToman(amountRial);
  const formatted = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(Math.abs(amount));
  return `${amount < 0 ? "−" : ""}${formatted} تومان`;
}

// Short form for chart axis ticks: no "تومان" suffix, so the Y axis stays
// narrow enough not to clip (desktop) or eat chart width (mobile).
export function formatAxisToman(amountRial: number) {
  const amount = rialToToman(amountRial);
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  const formatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
  if (absolute >= 1_000_000_000) return `${sign}${formatter.format(absolute / 1_000_000_000)} میلیارد`;
  if (absolute >= 1_000_000) return `${sign}${formatter.format(absolute / 1_000_000)} میلیون`;
  if (absolute >= 1_000) return `${sign}${formatter.format(absolute / 1_000)} هزار`;
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(amount);
}
