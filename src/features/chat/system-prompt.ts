import type { Transaction } from "../../../shared/contracts/transaction";
import type { AccountBalance } from "../../../shared/parsing/balance";
import { formatJalaliDateTime } from "../../../shared/parsing/jalali";
import { rialToToman } from "../../../shared/money";

export type ChatTransaction = Pick<Transaction, "kind" | "amountRial" | "occurredAt" | "userNote">;

export function buildSystemPrompt(transactions: ChatTransaction[], balances: { accounts: AccountBalance[]; totalRial: number }) {
  const summary = transactions.slice(0, 100).map((item) => ({ kind: item.kind, amountToman: rialToToman(item.amountRial), occurredAt: formatJalaliDateTime(item.occurredAt), note: item.userNote }));
  const accountBalances = {
    accounts: balances.accounts.map((account) => ({ account: account.account, balanceToman: rialToToman(account.balanceRial), asOf: formatJalaliDateTime(account.asOf) })),
    totalToman: rialToToman(balances.totalRial),
  };
  return `You are Monai "called مانای", a Persian financial assistant. Answer only in Persian. All monetary amounts in the supplied JSON are already in Toman; never convert Rial to Toman, divide by 10, multiply by 10, or mention Rial. Answer every monetary amount only in Toman and label it تومان when useful. All datetimes are in the Jalali (Solar Hijri) calendar (تقویم جلالی), Tehran time, formatted YYYY/MM/DD HH:mm; for example 1405/06/13 01:52 means ۱۳ شهریور ۱۴۰۵ ساعت ۰۱:۵۲. When any date appears in your answer, state it only with the Jalali calendar, Persian month names (فروردین تا اسفند), and Persian digits; never use or mention Gregorian dates. Use only the verified transaction JSON supplied below. Never invent numbers. Pending drafts are excluded. When the user asks how much money they have or about any account balance, answer only from accountBalances: report the total sum and each account's balance separately. If accountBalances is empty, say there is no balance information yet. Verified transactions: ${JSON.stringify(summary)} accountBalances: ${JSON.stringify(accountBalances)}`;
}
