import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowDown01Icon, ArrowUp01Icon, ReceiptIcon, Refresh01Icon, RepeatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef } from "react";
import { kindLabels, transactionDirection, type Transaction } from "@shared/contracts/transaction";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatJalali, formatToman } from "@/lib/utils";
import { transactionsInfiniteQuery } from "./api";

function direction(item: Transaction) {
  const flow = transactionDirection(item.kind);
  if (flow === "in") return { sign: "+", color: "text-income", icon: ArrowUp01Icon };
  if (flow === "out") return { sign: "−", color: "text-expense", icon: ArrowDown01Icon };
  return { sign: "", color: "text-muted-foreground", icon: RepeatIcon };
}

function groupLabel(date: string) {
  const day = new Date(date);
  const now = new Date();
  const difference = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())) / 86_400_000);
  if (difference === 0) return "امروز";
  if (difference === 1) return "دیروز";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(day);
}

export function TransactionsView({ onImport, onManual }: { onImport?: () => void; onManual?: () => void } = {}) {
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(transactionsInfiniteQuery());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const transactions = data?.pages.flatMap((page) => page.transactions) ?? [];

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || isFetchingNextPage || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage();
    }, { rootMargin: "300px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) return <p className="text-sm text-muted-foreground" role="status">در حال دریافت تراکنش‌ها...</p>;
  if (isError) return <div role="alert" className="rounded-xl border border-expense/30 bg-expense/10 p-5"><p className="text-sm text-expense">تراکنش‌ها بارگذاری نشدند.</p><Button className="mt-3" onClick={() => void refetch()} variant="secondary"><HugeiconsIcon icon={Refresh01Icon} size={16} />تلاش دوباره</Button></div>;
  if (!transactions.length) return <div className="grid min-h-72 place-content-center text-center"><HugeiconsIcon className="mx-auto text-primary" icon={ReceiptIcon} size={36} /><h2 className="mt-4 font-bold">هنوز تراکنش تأییدشده‌ای نیست</h2><p className="mt-2 text-sm text-muted-foreground">پیام بانکی وارد کن یا یک تراکنش را دستی ثبت کن.</p>{(onImport || onManual) && <div className="mt-5 flex flex-wrap justify-center gap-2">{onImport && <Button onClick={onImport}>ورود پیام بانکی</Button>}{onManual && <Button onClick={onManual} variant="outline">ثبت دستی</Button>}</div>}</div>;
  const groups = transactions.reduce((result, item) => { const label = groupLabel(item.occurredAt); const group = result.get(label) ?? []; group.push(item); result.set(label, group); return result; }, new Map<string, Transaction[]>());
  return <div className="space-y-6">{[...groups].map(([label, items]) => <section key={label}><h2 className="mb-2 text-sm font-semibold text-muted-foreground">{label}</h2><div className="space-y-2">{items.map((item) => { const semantic = direction(item); return <article className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4" key={item.id}><HugeiconsIcon className={semantic.color} icon={semantic.icon} size={22} /><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{item.userNote || item.bankDescription || kindLabels[item.kind]}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{formatJalali(item.occurredAt)} · {kindLabels[item.kind]}</p>{item.accountId && <p className="mt-1 truncate text-xs text-muted-foreground">شماره حساب: <span dir="ltr">{item.accountId}</span></p>}</div><strong className={`shrink-0 text-sm ${semantic.color}`} dir="ltr">{semantic.sign}{formatToman(item.amountRial)}</strong></article>; })}</div></section>)}<div ref={sentinelRef} />{isFetchingNextPage && <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground" role="status"><Spinner />در حال دریافت تراکنش‌های بیشتر...</p>}{hasNextPage && typeof IntersectionObserver === "undefined" && !isFetchingNextPage && <Button className="w-full" onClick={() => void fetchNextPage()} variant="outline">نمایش تراکنش‌های بیشتر</Button>}{!hasNextPage && <p className="py-4 text-center text-xs text-muted-foreground">همه تراکنش‌ها نمایش داده شد.</p>}</div>;
}
