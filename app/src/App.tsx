import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/app/app-shell";
import { viewParser, type View } from "@/app/navigation";
import { enrichmentQuery } from "@/features/enrichment/api";
import { EnrichmentView } from "@/features/enrichment/enrichment-view";
import { CaptureSheet, type CaptureStep } from "@/features/imports/capture-sheet";
import { TransactionsView } from "@/features/transactions/transactions-view";
const ChatView = lazy(() => import("@/features/chat/chat-view").then((module) => ({ default: module.ChatView })));

function Home({ onCapture, onEnrichment }: { onCapture: () => void; onEnrichment: () => void }) {
  const { data } = useQuery(enrichmentQuery);
  return <div className="space-y-5"><div><p className="text-sm text-muted-foreground">امروز</p><h2 className="mt-1 text-2xl font-bold">سلام، علی</h2><p className="mt-2 text-sm text-muted-foreground">پیام‌های بانکی را به داده مالی قابل بررسی تبدیل کن.</p></div><section className="rounded-xl bg-primary p-5 text-white"><p className="text-sm text-white/75">شروع سریع</p><h2 className="mt-3 text-2xl font-bold">اولین پیام بانکی را وارد کن</h2><p className="mt-2 text-sm text-white/75">تا قبل از تأیید، هیچ پیش‌نویسی وارد گزارش‌ها نمی‌شود.</p><Button className="mt-5 bg-white text-primary hover:bg-white/90" onClick={onCapture}>ثبت پیام</Button></section><section className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">تکمیل اطلاعات</h2><p className="mt-1 text-sm text-muted-foreground">{data?.count ?? 0} تراکنش منتظر بررسی است.</p></div><strong className="text-2xl text-primary">{data?.count ?? 0}</strong></div><Button className="mt-4 w-full" variant="secondary" onClick={onEnrichment}>بررسی تراکنش‌ها</Button></section></div>;
}

function Settings() {
  return <section className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">ظاهر برنامه</h2><p className="mt-1 text-sm text-muted-foreground">تم روشن یا تیره را تغییر بده.</p><Button className="mt-4" variant="secondary" onClick={() => { const dark = document.documentElement.classList.toggle("dark"); localStorage.setItem("monai-theme", dark ? "dark" : "light"); }}>تغییر تم</Button></section>;
}

export default function App() {
  const [view, setView] = useQueryState("view", viewParser);
  const [capture, setCapture] = useState<CaptureStep | null>(null);
  const { data } = useQuery(enrichmentQuery);
  const content: Record<View, React.ReactNode> = {
    home: <Home onCapture={() => setCapture("choose")} onEnrichment={() => void setView("enrichment")} />,
    transactions: <TransactionsView />,
    enrichment: <EnrichmentView />,
    chat: <Suspense fallback={<p className="text-sm text-muted-foreground">در حال آماده‌سازی گفت‌وگو...</p>}><ChatView /></Suspense>,
    settings: <Settings />,
  };
  return <AppShell onCapture={() => setCapture("choose")} onView={(value) => void setView(value)} pendingCount={data?.count ?? 0} view={view}>{content[view]}<CaptureSheet capture={capture} onCaptureChange={setCapture} onCreated={() => void setView("enrichment")} /></AppShell>;
}
