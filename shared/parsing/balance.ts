import type { Transaction } from "../contracts/transaction";
import { gregorianToJalali } from "./jalali";
import { parseSms } from "./sms";

const bankLabels: Record<string, string> = { blu: "بلو", tejarat: "بانک تجارت", mellat: "بانک ملت", resalat: "بانک رسالت" };

type BalanceSource = Pick<Transaction, "accountId" | "bankId" | "balanceAfterRial" | "occurredAt">;

type BalanceTransaction = BalanceSource & Pick<Transaction, "originalMessage">;

export type AccountBalance = { account: string; balanceRial: number; asOf: string };

export type BalanceTimelinePoint = { date: string; totalRial: number };

const tehranOffsetMs = 3.5 * 60 * 60 * 1000;

// Single source of truth for account identity across the chart and the chat
// balance summary: a transaction without accountId or bankId belongs to ONE
// shared "unknown" account — never to a per-transaction phantom account.
export function accountKey(item: BalanceSource) {
  return item.accountId ?? item.bankId ?? "unknown";
}

function accountLabel(item: BalanceSource) {
  if (item.accountId) {
    const bank = item.bankId ? bankLabels[item.bankId] : null;
    return bank ? `${bank} ${item.accountId}` : `حساب ${item.accountId}`;
  }
  if (item.bankId) return bankLabels[item.bankId] ?? item.bankId;
  return "سایر حساب‌ها";
}

function pickLatest(current: AccountBalance | undefined, candidate: AccountBalance) {
  return !current || Date.parse(candidate.asOf) > Date.parse(current.asOf) ? candidate : current;
}

function tehranJalaliDay(occurredAt: string) {
  const tehran = new Date(new Date(occurredAt).getTime() + tehranOffsetMs);
  const { jy, jm, jd } = gregorianToJalali(tehran.getUTCFullYear(), tehran.getUTCMonth() + 1, tehran.getUTCDate());
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}

export function withLegacyBalances<T extends BalanceTransaction>(transactions: T[]): T[] {
  return transactions.map((item) => {
    if (item.balanceAfterRial != null || !item.originalMessage) return item;
    const parsed = parseSms(item.originalMessage);
    if (parsed.balanceAfterRial == null) return item;
    return { ...item, balanceAfterRial: parsed.balanceAfterRial, accountId: item.accountId ?? parsed.accountId };
  });
}

// The one balance fold: keeps each account's latest balance and, separately,
// its closing balance per Tehran-local Jalali day. `summarizeBalances` reads the
// former and `balanceTimeline` reads the latter, so the chat's total and the
// chart's final point are two projections of the same fold and cannot disagree.
export function balanceByDay(transactions: BalanceSource[]) {
  const latest = new Map<string, AccountBalance>();
  const byDay = new Map<string, Map<string, AccountBalance>>();
  for (const item of transactions) {
    if (item.balanceAfterRial == null) continue;
    const key = accountKey(item);
    const candidate = { account: accountLabel(item), balanceRial: item.balanceAfterRial, asOf: item.occurredAt };
    latest.set(key, pickLatest(latest.get(key), candidate));
    const date = tehranJalaliDay(item.occurredAt);
    const accounts = byDay.get(date) ?? new Map<string, AccountBalance>();
    accounts.set(key, pickLatest(accounts.get(key), candidate));
    byDay.set(date, accounts);
  }
  const running = new Map<string, number>();
  const days = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, accounts]) => {
      for (const [key, account] of accounts) running.set(key, account.balanceRial);
      return { date, totalRial: [...running.values()].reduce((sum, amount) => sum + amount, 0) };
    });
  const accounts = [...latest.values()];
  return { accounts, days, totalRial: accounts.reduce((sum, account) => sum + account.balanceRial, 0) };
}

export function summarizeBalances(transactions: BalanceSource[]) {
  const { accounts, totalRial } = balanceByDay(transactions);
  return { accounts, totalRial };
}

export function balanceTimeline(transactions: BalanceSource[]): BalanceTimelinePoint[] {
  return balanceByDay(transactions).days;
}
