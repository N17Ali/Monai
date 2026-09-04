import type { Transaction } from "../../../shared/contracts/transaction";
import { parseSms } from "../../../shared/parsing/sms";

const bankLabels: Record<string, string> = { blu: "بلو", tejarat: "بانک تجارت", mellat: "بانک ملت", resalat: "بانک رسالت" };

type BalanceSource = Pick<Transaction, "accountId" | "bankId" | "balanceAfterRial" | "occurredAt">;

type BalanceTransaction = BalanceSource & Pick<Transaction, "originalMessage">;

export type AccountBalance = { account: string; balanceRial: number; asOf: string };

function accountLabel(item: BalanceSource) {
  if (item.accountId) {
    const bank = item.bankId ? bankLabels[item.bankId] : null;
    return bank ? `${bank} ${item.accountId}` : `حساب ${item.accountId}`;
  }
  if (item.bankId) return bankLabels[item.bankId] ?? item.bankId;
  return "سایر حساب‌ها";
}

export function withLegacyBalances<T extends BalanceTransaction>(transactions: T[]): T[] {
  return transactions.map((item) => {
    if (item.balanceAfterRial != null || !item.originalMessage) return item;
    const parsed = parseSms(item.originalMessage);
    if (parsed.balanceAfterRial == null) return item;
    return { ...item, balanceAfterRial: parsed.balanceAfterRial, accountId: item.accountId ?? parsed.accountId };
  });
}

export function summarizeBalances(transactions: BalanceSource[]) {
  const latest = new Map<string, AccountBalance>();
  for (const item of transactions) {
    if (item.balanceAfterRial == null) continue;
    const key = item.accountId ?? item.bankId ?? "unknown";
    const existing = latest.get(key);
    if (!existing || Date.parse(item.occurredAt) > Date.parse(existing.asOf)) {
      latest.set(key, { account: accountLabel(item), balanceRial: item.balanceAfterRial, asOf: item.occurredAt });
    }
  }
  const accounts = [...latest.values()];
  return { accounts, totalRial: accounts.reduce((sum, account) => sum + account.balanceRial, 0) };
}
