import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { enrichmentUpdateSchema, kindLabels, type EnrichmentUpdateInput, type Transaction } from "@shared/contracts/transaction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/shared/api/client";
import { transactionKeys } from "@/features/transactions/api";
import { enrichmentKeys, enrichmentQuery } from "./api";

function DraftForm({ draft }: { draft: Transaction }) {
  const queryClient = useQueryClient();
  const form = useForm<EnrichmentUpdateInput>({ resolver: zodResolver(enrichmentUpdateSchema), defaultValues: { kind: draft.kind === "unknown" ? "expense" : draft.kind, amountToman: draft.amountRial / 10, note: draft.userNote ?? "" } });
  const mutation = useMutation({ mutationFn: (values: EnrichmentUpdateInput) => api(`/api/enrichment/${draft.id}`, { method: "POST", body: JSON.stringify(values) }), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: enrichmentKeys.all }), queryClient.invalidateQueries({ queryKey: transactionKeys.all })]); toast.success("تراکنش تأیید شد"); }, onError: () => toast.error("تأیید تراکنش انجام نشد") });
  const kinds = ["expense", "income", "transfer_out", "transfer_in"] as const;
  return <form className="rounded-xl border border-border bg-surface p-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><h2 className="font-semibold">تراکنش نیازمند بررسی</h2><div className="mt-4 grid grid-cols-2 gap-2">{kinds.map((kind) => <button className={`min-h-11 rounded-lg border ${form.watch("kind") === kind ? "border-primary bg-primary-soft text-primary" : "border-border"}`} key={kind} type="button" onClick={() => form.setValue("kind", kind)}>{kindLabels[kind]}</button>)}</div><label className="mt-4 block text-sm font-medium">مبلغ به تومان<Input className="mt-2" type="number" {...form.register("amountToman", { valueAsNumber: true })} /></label>{draft.sourceDateText && <div className="mt-4 rounded-lg bg-surface-muted p-3 text-sm"><span className="text-muted-foreground">تاریخ استخراج‌شده</span><strong className="mt-1 block" dir="ltr">{draft.sourceDateText}</strong></div>}<label className="mt-4 block text-sm font-medium">توضیح<Textarea className="mt-2 min-h-20" {...form.register("note")} /></label><details className="mt-4 text-sm"><summary className="cursor-pointer text-primary">مشاهده پیام اصلی</summary><p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-muted p-3 leading-7">{draft.originalMessage}</p></details><Button disabled={mutation.isPending} className="mt-4 w-full" type="submit">تأیید تراکنش</Button></form>;
}

export function EnrichmentView() {
  const { data, isPending } = useQuery(enrichmentQuery);
  if (isPending) return <p className="text-sm text-muted-foreground">در حال دریافت پیش‌نویس‌ها...</p>;
  if (!data?.drafts.length) return <div className="grid min-h-72 place-content-center text-center"><h2 className="font-bold">همه‌چیز بررسی شده</h2><p className="mt-2 text-sm text-muted-foreground">پیام‌های جدید اینجا نمایش داده می‌شوند.</p></div>;
  return <div className="space-y-4">{data.drafts.map((draft) => <DraftForm draft={draft} key={draft.id} />)}</div>;
}
