import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowDown01Icon, ArrowUp01Icon, Delete01Icon, Edit01Icon, ReceiptIcon, Refresh01Icon, RepeatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { kindLabels, transactionDirection, type Transaction } from "@shared/contracts/transaction";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatJalali, formatToman, toPersianDigits } from "@/lib/utils";
import { tehranJalaliDay } from "@shared/parsing/tehran-day";
import { jalaliToGregorian } from "@shared/parsing/jalali";
import { useDeleteTransaction, transactionsInfiniteQuery } from "./api";
import { EditTransactionDialog } from "./edit-transaction-dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

function direction(item: Transaction) {
  const flow = transactionDirection(item.kind);
  if (flow === "in") return { sign: "+", color: "text-income", icon: item.kind === "transfer_in" ? RepeatIcon : ArrowUp01Icon };
  if (flow === "out") return { sign: "−", color: "text-expense", icon: ArrowDown01Icon };
  if (item.kind === "transfer_out") return { sign: "", color: "text-expense", icon: RepeatIcon };
  return { sign: "", color: "text-muted-foreground", icon: RepeatIcon };
}

function groupLabel(date: string) {
  const day = tehranJalaliDay(date);
  const today = tehranJalaliDay(new Date().toISOString());
  const dayGregorian = jalaliToGregorian(day.jy, day.jm, day.jd);
  const todayGregorian = jalaliToGregorian(today.jy, today.jm, today.jd);
  const difference = Math.floor((Date.UTC(todayGregorian.gy, todayGregorian.gm - 1, todayGregorian.gd) - Date.UTC(dayGregorian.gy, dayGregorian.gm - 1, dayGregorian.gd)) / 86_400_000);
  if (difference === 0) return "امروز";
  if (difference === 1) return "دیروز";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Date.UTC(dayGregorian.gy, dayGregorian.gm - 1, dayGregorian.gd)));
}

function SwipeableTransactionCard({ item, onEdit, onDelete }: { item: Transaction; onEdit: () => void; onDelete: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const suppressClick = useRef(false);
  const semantic = direction(item);
  const actionWidth = 116;
  const offset = dragging ? dragX : revealed ? actionWidth : 0;

  return <div className="relative overflow-hidden rounded-xl">
    <div className="absolute inset-y-0 left-0 flex w-[116px] items-center justify-center gap-2 px-2" aria-hidden={!revealed}>
      <Button aria-label="ویرایش تراکنش" className="size-11 rounded-full bg-[#e9aa22] text-white shadow-sm hover:bg-[#d99a12]" onClick={(event) => { event.stopPropagation(); onEdit(); setRevealed(false); }} size="icon" tabIndex={revealed ? 0 : -1}><HugeiconsIcon icon={Edit01Icon} size={19} /></Button>
      <Button aria-label="حذف تراکنش" className="size-11 rounded-full bg-[#e5484d] text-white shadow-sm hover:bg-[#d0373c]" onClick={(event) => { event.stopPropagation(); onDelete(); setRevealed(false); }} size="icon" tabIndex={revealed ? 0 : -1}><HugeiconsIcon icon={Delete01Icon} size={19} /></Button>
    </div>
    <article
      className={`swipe-transaction-card relative flex touch-pan-y items-center gap-3 rounded-xl border border-border bg-surface p-4 will-change-transform ${dragging ? "" : "transition-transform duration-[220ms] ease-[var(--ease-drawer)]"}`}
      style={{ transform: `translate3d(${offset}px,0,0)` }}
      onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if (revealed) setRevealed(false); }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        startX.current = event.clientX;
        startOffset.current = revealed ? actionWidth : 0;
        setDragX(startOffset.current);
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (startX.current == null) return;
        const delta = event.clientX - startX.current;
        setDragX(Math.max(0, Math.min(actionWidth, startOffset.current + delta)));
      }}
      onPointerUp={(event) => {
        if (startX.current == null) return;
        const delta = event.clientX - startX.current;
        const finalOffset = Math.max(0, Math.min(actionWidth, startOffset.current + delta));
        suppressClick.current = Math.abs(delta) > 5;
        startX.current = null;
        setDragging(false);
        setDragX(0);
        setRevealed(finalOffset > actionWidth / 2);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { startX.current = null; setDragging(false); setDragX(0); }}
    >
      <HugeiconsIcon className={semantic.color} icon={semantic.icon} size={22} />
      <div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{item.userNote || item.bankDescription || kindLabels[item.kind]}</h3><p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{formatJalali(item.occurredAt)} · {kindLabels[item.kind]}</p>{item.accountId && <p className="mt-1 whitespace-normal text-xs text-muted-foreground">شماره حساب: <span className="font-sans [overflow-wrap:anywhere]" dir="ltr">{toPersianDigits(item.accountId)}</span></p>}</div>
      <strong className={`shrink-0 text-sm ${semantic.color}`} dir="ltr">{semantic.sign}{formatToman(item.amountRial)}</strong>
    </article>
  </div>;
}

export function TransactionsView({ onImport, onManual }: { onImport?: () => void; onManual?: () => void } = {}) {
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(transactionsInfiniteQuery());
  const deleteMutation = useDeleteTransaction();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
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
  return <><div className="space-y-6">{[...groups].map(([label, items]) => <section key={label}><h2 className="mb-2 text-sm font-semibold text-muted-foreground">{label}</h2><div className="space-y-2">{items.map((item) => <SwipeableTransactionCard key={item.id} item={item} onEdit={() => { setEditing(item); setEditOpen(true); }} onDelete={() => setDeleting(item)} />)}</div></section>)}<div ref={sentinelRef} />{isFetchingNextPage && <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground" role="status"><Spinner />در حال دریافت تراکنش‌های بیشتر...</p>}{hasNextPage && typeof IntersectionObserver === "undefined" && !isFetchingNextPage && <Button className="w-full" onClick={() => void fetchNextPage()} variant="outline">نمایش تراکنش‌های بیشتر</Button>}{!hasNextPage && <p className="py-4 text-center text-xs text-muted-foreground">همه تراکنش‌ها نمایش داده شد.</p>}</div><EditTransactionDialog transaction={editing} open={editOpen} onOpenChange={setEditOpen} /><Drawer open={deleting != null} onOpenChange={(open) => { if (!open) setDeleting(null); }} showSwipeHandle><DrawerContent><DrawerHeader className="text-start"><DrawerTitle>حذف تراکنش؟</DrawerTitle><DrawerDescription>این تراکنش برای همیشه حذف می‌شود و قابل بازگردانی نیست.</DrawerDescription></DrawerHeader><DrawerFooter className="pt-8"><Button disabled={deleteMutation.isPending} onClick={() => setDeleting(null)} variant="outline">انصراف</Button><Button disabled={deleteMutation.isPending} onClick={() => { if (!deleting) return; deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) }); }} variant="destructive">{deleteMutation.isPending ? "در حال حذف..." : "حذف دائمی"}</Button></DrawerFooter></DrawerContent></Drawer></>;
}
