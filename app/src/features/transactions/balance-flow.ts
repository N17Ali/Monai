import type { Transaction } from "@shared/contracts/transaction";
import { transactionDirection } from "@shared/contracts/transaction";
import { balanceTimeline, withLegacyBalances } from "@shared/parsing/balance";
import { jalaliMonthName } from "@shared/parsing/jalali";
import { tehranJalaliDay } from "@shared/parsing/tehran-day";
export { formatAxisToman, formatCompactToman, formatExactToman } from "./balance-format";

export type BalanceFlowPoint = {
  date: string;
  label: string;
  netRial: number;
  cumulativeRial: number;
};

function dayLabel(date: string) {
  const [, month, day] = date.split("/").map(Number);
  return `${new Intl.NumberFormat("fa-IR").format(day)} ${jalaliMonthName(month)}`;
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
  const nowParts = tehranJalaliDay(now.toISOString());
  let incomeRial = 0;
  let expenseRial = 0;
  for (const item of transactions) {
    const parts = tehranJalaliDay(item.occurredAt);
    if (parts.jy !== nowParts.jy || parts.jm !== nowParts.jm) continue;
    const direction = transactionDirection(item.kind);
    if (direction === "in") incomeRial += item.amountRial;
    else if (direction === "out") expenseRial += item.amountRial;
  }
  return { incomeRial, expenseRial, netRial: incomeRial - expenseRial };
}
