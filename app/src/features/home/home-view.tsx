import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { enrichmentQuery } from "@/features/enrichment/api";
import { transactionsQuery } from "@/features/transactions/api";
import { BalanceFlowChart } from "@/features/transactions/balance-flow-chart";
import { buildBalanceFlow, monthlyTotals } from "@/features/transactions/balance-flow";
import { formatToman } from "@/lib/utils";

type HomeProps = { onCapture: () => void; onEnrichment: () => void; onTransactions: () => void };

export function Home({ onCapture, onEnrichment, onTransactions }: HomeProps) {
  const { data: drafts } = useQuery(enrichmentQuery);
  const { data: transactionData, isError } = useQuery(transactionsQuery);
  const transactions = transactionData?.transactions ?? [];
  const pendingCount = drafts?.count ?? 0;
  const flow = buildBalanceFlow(transactions);
  const totals = monthlyTotals(transactions);
  if (isError) return <div role="alert" className="rounded-xl border border-expense/30 bg-expense/10 p-5"><h2 className="font-semibold">اطلاعات مالی بارگذاری نشد.</h2><p className="mt-1 text-sm text-muted-foreground">صفحه را دوباره بارگذاری کن.</p></div>;
  return <div className="space-y-5"><div><p className="text-sm text-muted-foreground">امروز</p><h2 className="mt-1 text-2xl font-bold">سلام، علی</h2><p className="mt-2 text-sm text-muted-foreground">{transactions.length || pendingCount ? "قدم بعدی‌ات را از وضعیت مالی‌ات انتخاب کن." : "پیام بانکی را به داده مالی قابل بررسی تبدیل کن."}</p></div>{transactions.length === 0 && pendingCount === 0 && <section className="rounded-xl bg-primary p-5 text-white"><p className="text-sm text-white/75">شروع سریع</p><h2 className="mt-3 text-2xl font-bold">اولین تراکنشت را وارد کن</h2><p className="mt-2 text-sm text-white/75">پیام بانکی را اضافه کن تا قبل از نمایش در گزارش‌ها آن را بررسی کنی.</p><Button className="mt-5 bg-white text-primary hover:bg-white/90" onClick={onCapture}>ورود پیام بانکی</Button></section>}{transactions.length > 0 && <><section className="rounded-xl bg-primary p-5 text-white"><p className="text-sm text-white/75">خلاصه وضعیت مالی</p><h2 className="mt-2 text-2xl font-bold">وضعیت مالی‌ات را بررسی کن</h2><p className="mt-1 text-sm text-white/75">آخرین تراکنش‌ها و خلاصه این ماه را ببین.</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["درآمد این ماه", totals.incomeRial], ["هزینه این ماه", totals.expenseRial], ["خالص این ماه", totals.netRial], ["تأییدشده", transactions.length]].map(([label, value]) => <div className="rounded-lg bg-white/10 p-3" key={label}><span className="block text-xs text-white/75">{label}</span><strong className="mt-1 block text-sm">{label === "تأییدشده" ? new Intl.NumberFormat("fa-IR").format(Number(value)) : formatToman(Number(value))}</strong></div>)}</div><div className="mt-5 flex flex-wrap gap-2"><Button className="bg-white text-primary hover:bg-white/90" onClick={onCapture}>ثبت تراکنش</Button><Button className="border-white/30 text-white hover:bg-white/10" onClick={onTransactions} variant="outline">مشاهده تراکنش‌ها</Button></div></section><BalanceFlowChart points={flow} /></>}{<section className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">{pendingCount > 0 ? `${new Intl.NumberFormat("fa-IR").format(pendingCount)} تراکنش منتظر بررسی است` : "همه تراکنش‌ها بررسی شده‌اند"}</h2><p className="mt-1 text-sm text-muted-foreground">{pendingCount > 0 ? "اطلاعات استخراج‌شده را بررسی کن تا وارد گزارش‌ها شوند." : "برای شروع دوباره یک پیام جدید وارد کن."}</p></div><strong className="text-2xl text-primary">{new Intl.NumberFormat("fa-IR").format(pendingCount)}</strong></div><Button className="mt-4 w-full" variant="secondary" onClick={pendingCount > 0 ? onEnrichment : onCapture}>{pendingCount > 0 ? "بررسی تراکنش‌ها" : "ورود پیام جدید"}</Button></section>}</div>;
}
