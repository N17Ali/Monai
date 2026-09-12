import type { Transaction, TransactionKind } from "@shared/contracts/transaction";
import { gregorianToJalali } from "@shared/parsing/jalali";
import { accountKey, withLegacyBalances } from "@shared/parsing/balance";

export type BalanceFlowPoint = {
  date: string;
  label: string;
  netRial: number;
  cumulativeRial: number;
};

const positiveKinds: TransactionKind[] = ["income", "refund", "transfer_in"];
const negativeKinds: TransactionKind[] = ["expense", "fee", "transfer_out", "cash_withdrawal"];

function dayParts(date: string) {
  const tehran = new Date(new Date(date).getTime() + 3.5 * 60 * 60 * 1000);
  return gregorianToJalali(tehran.getUTCFullYear(), tehran.getUTCMonth() + 1, tehran.getUTCDate());
}

export function buildBalanceFlow(transactions: Transaction[]): BalanceFlowPoint[] {
  // Same account identity and balance recovery as the chat balance summary
  // (shared/parsing/balance.ts), so the chart and the model can never
  // disagree: one "unknown" bucket for unidentified accounts, and stored-null
  // balances recovered by re-parsing the original SMS.
  const recovered = withLegacyBalances(transactions);
  // Per Jalali day, per account: keep the balance of the day's LATEST
  // transaction (the closing balance). Input order must not matter — the API
  // returns transactions newest-first.
  const byDay = new Map<string, Map<string, { occurredAt: string; balanceRial: number }>>();
  for (const item of recovered) {
    if (item.balanceAfterRial == null) continue;
    const parts = dayParts(item.occurredAt);
    const date = `${parts.jy}/${String(parts.jm).padStart(2, "0")}/${String(parts.jd).padStart(2, "0")}`;
    const account = accountKey(item);
    const accounts = byDay.get(date) ?? new Map<string, { occurredAt: string; balanceRial: number }>();
    const current = accounts.get(account);
    if (!current || item.occurredAt >= current.occurredAt) accounts.set(account, { occurredAt: item.occurredAt, balanceRial: item.balanceAfterRial });
    byDay.set(date, accounts);
  }
  const balances = new Map<string, number>();
  let previousTotal: number | null = null;
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, accounts]) => {
    for (const [account, { balanceRial }] of accounts) balances.set(account, balanceRial);
    const cumulativeRial = [...balances.values()].reduce((sum, amount) => sum + amount, 0);
    const netRial = previousTotal == null ? 0 : cumulativeRial - previousTotal;
    previousTotal = cumulativeRial;
    const [, month, day] = date.split("/").map(Number);
    const months = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    const label = `${new Intl.NumberFormat("fa-IR").format(day)} ${months[month - 1]}`;
    return { date, label, netRial, cumulativeRial };
  });
}

export function monthlyTotals(transactions: Transaction[], now = new Date()) {
  const nowParts = dayParts(now.toISOString());
  let incomeRial = 0;
  let expenseRial = 0;
  for (const item of transactions) {
    const parts = dayParts(item.occurredAt);
    if (parts.jy !== nowParts.jy || parts.jm !== nowParts.jm) continue;
    if (positiveKinds.includes(item.kind)) incomeRial += item.amountRial;
    else if (negativeKinds.includes(item.kind)) expenseRial += item.amountRial;
  }
  return { incomeRial, expenseRial, netRial: incomeRial - expenseRial };
}

export function formatCompactToman(amountRial: number) {
  const amount = amountRial / 10;
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
  const amount = amountRial / 10;
  const formatted = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(Math.abs(amount));
  return `${amount < 0 ? "−" : ""}${formatted} تومان`;
}

// Short form for chart axis ticks: no "تومان" suffix, so the Y axis stays
// narrow enough not to clip (desktop) or eat chart width (mobile).
export function formatAxisToman(amountRial: number) {
  const amount = amountRial / 10;
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  const formatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
  if (absolute >= 1_000_000_000) return `${sign}${formatter.format(absolute / 1_000_000_000)} میلیارد`;
  if (absolute >= 1_000_000) return `${sign}${formatter.format(absolute / 1_000_000)} میلیون`;
  if (absolute >= 1_000) return `${sign}${formatter.format(absolute / 1_000)} هزار`;
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(amount);
}
