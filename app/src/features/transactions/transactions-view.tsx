import { useQuery } from "@tanstack/react-query";
import { ReceiptIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { kindLabels } from "@shared/contracts/transaction";
import { transactionsQuery } from "./api";
import { formatJalali, formatToman } from "@/lib/utils";

export function TransactionsView() {
  const { data, isPending, isError } = useQuery(transactionsQuery);
  if (isPending) return <p className="text-sm text-muted-foreground">در حال دریافت تراکنش‌ها...</p>;
  if (isError) return <p className="text-sm text-expense">دریافت تراکنش‌ها انجام نشد.</p>;
  if (!data.transactions.length) return <div className="grid min-h-72 place-content-center text-center"><HugeiconsIcon className="mx-auto text-primary" icon={ReceiptIcon} size={36} /><h2 className="mt-4 font-bold">هنوز تراکنش تأییدشده‌ای نیست</h2><p className="mt-2 text-sm text-muted-foreground">پیام‌های بانکی ابتدا در تکمیل اطلاعات قرار می‌گیرند.</p></div>;
  return <div className="space-y-2">{data.transactions.map((item) => <article className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4" key={item.id}><div className="min-w-0 flex-1"><h2 className="font-semibold">{item.userNote || item.bankDescription || kindLabels[item.kind]}</h2><p className="mt-1 text-xs text-muted-foreground">{formatJalali(item.occurredAt)}</p></div><strong>{formatToman(item.amountRial)}</strong></article>)}</div>;
}
