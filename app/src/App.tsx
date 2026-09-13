import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/app/app-shell";
import { viewParser, type View } from "@/app/navigation";
import { enrichmentQuery } from "@/features/enrichment/api";
import { Home } from "@/features/home/home-view";
import { EnrichmentView } from "@/features/enrichment/enrichment-view";
import { useCaptureFlow } from "@/features/imports/capture";
import { CaptureSheet } from "@/features/imports/capture-sheet";
import { TransactionsView } from "@/features/transactions/transactions-view";

const ChatView = lazy(() => import("@/features/chat/chat-view").then((module) => ({ default: module.ChatView })));

export { Home } from "@/features/home/home-view";

function Settings() {
  return <section className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">ظاهر برنامه</h2><p className="mt-1 text-sm text-muted-foreground">تم روشن یا تیره را تغییر بده.</p><Button className="mt-4" variant="secondary" onClick={() => { const dark = document.documentElement.classList.toggle("dark"); localStorage.setItem("monai-theme", dark ? "dark" : "light"); }}>تغییر تم</Button></section>;
}

export default function App() {
  const [view, setView] = useQueryState("view", viewParser);
  const capture = useCaptureFlow(() => void setView("enrichment"));
  const { data } = useQuery(enrichmentQuery);
  const content: Record<View, React.ReactNode> = {
    home: <Home onCapture={capture.open} onEnrichment={() => void setView("enrichment")} onTransactions={() => void setView("transactions")} />,
    transactions: <TransactionsView onImport={() => capture.choose("clipboard")} onManual={() => capture.choose("manual")} />,
    enrichment: <EnrichmentView />,
    chat: <Suspense fallback={<p className="text-sm text-muted-foreground" role="status">در حال آماده‌سازی گفت‌وگو...</p>}><ChatView /></Suspense>,
    settings: <Settings />,
  };
  return <AppShell onCapture={capture.open} onView={(value) => void setView(value)} pendingCount={data?.count ?? 0} view={view}>{content[view]}<CaptureSheet capture={capture.step} onCaptureChange={capture.setStep} onCreated={capture.review} /></AppShell>;
}
