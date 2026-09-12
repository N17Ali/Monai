import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { DatePicker } from "@jalali-js/react";
import { enrichmentUpdateSchema, kindLabels, type EnrichmentUpdateInput, type Transaction } from "@shared/contracts/transaction";
import { jalaliToIso, nowJalaliTehran } from "@shared/parsing/jalali";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/shared/api/client";
import { transactionKeys } from "@/features/transactions/api";
import { enrichmentKeys, enrichmentQuery } from "./api";

const kinds = ["expense", "income", "transfer_out", "transfer_in"] as const;

function draftDefaults(draft: Transaction): EnrichmentUpdateInput {
  return { kind: draft.kind === "unknown" ? "expense" : draft.kind, amountToman: draft.amountRial / 10, note: draft.userNote ?? "", occurredAt: draft.occurredAt };
}

function jalaliPartsFromIso(iso: string) {
  const parts = nowJalaliTehran(new Date(iso));
  return { precision: "datetime", system: "jalali", year: parts.jy, month: parts.jm, day: parts.jd, hour: parts.hour, minute: parts.minute, second: 0, millisecond: 0 } as const;
}

function DraftForm({ draft, position, total, onAdvance }: { draft: Transaction; position: number; total: number; onAdvance: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<EnrichmentUpdateInput>({ resolver: zodResolver(enrichmentUpdateSchema), defaultValues: draftDefaults(draft) });
  const mutation = useMutation({ mutationFn: (values: EnrichmentUpdateInput) => api(`/api/enrichment/${draft.id}`, { method: "POST", body: JSON.stringify(values) }), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: enrichmentKeys.all }), queryClient.invalidateQueries({ queryKey: transactionKeys.all })]); toast.success("تراکنش تأیید شد"); onAdvance(); }, onError: () => toast.error("تأیید تراکنش انجام نشد. اطلاعاتت حفظ شد.") });
  const reject = useMutation({ mutationFn: () => api(`/api/enrichment/${draft.id}`, { method: "DELETE" }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: enrichmentKeys.all }); toast.success("پیش‌نویس نادیده گرفته شد"); onAdvance(); }, onError: () => toast.error("نادیده گرفتن پیش‌نویس انجام نشد") });
  const errors = form.formState.errors;
  const errorText = (name: keyof EnrichmentUpdateInput) => errors[name]?.message;
  useEffect(() => { form.reset(draftDefaults(draft)); }, [draft.id]);
  return <form className="rounded-xl border border-border bg-surface p-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><div className="flex items-center justify-between"><p className="text-sm font-medium text-muted-foreground" aria-live="polite">تراکنش {new Intl.NumberFormat("fa-IR").format(position)} از {new Intl.NumberFormat("fa-IR").format(total)}</p><span className="rounded-full bg-primary-soft px-2 py-1 text-xs text-primary">در انتظار بررسی</span></div><div className="mt-4 rounded-lg bg-surface-muted p-3"><p className="font-semibold">{draft.bankId ? `بانک ${draft.bankId}` : "پیام بانکی"}</p><p className="mt-1">{kindLabels[draft.kind]}</p><p className="mt-1 font-bold">{new Intl.NumberFormat("fa-IR").format(draft.amountRial / 10)} تومان</p><p className="mt-1 text-sm" dir="ltr"><span className="text-muted-foreground">تاریخ استخراج‌شده</span><span aria-hidden="true">: </span>{draft.sourceDateText ?? draft.occurredAt}</p></div>{draft.dateWasInferred && <p className="mt-3 rounded-lg bg-warning/10 p-3 text-sm text-warning" role="status">این تاریخ از متن پیام حدس زده شده است. لطفاً بررسی کن.</p>}<fieldset className="mt-4"><legend className="mb-2 text-sm font-medium">نوع تراکنش</legend><div className="grid grid-cols-2 gap-2">{kinds.map((kind) => <button aria-pressed={form.watch("kind") === kind} className={`min-h-11 rounded-lg border ${form.watch("kind") === kind ? "border-primary bg-primary-soft text-primary" : "border-border"}`} key={kind} type="button" onClick={() => form.setValue("kind", kind, { shouldValidate: true })}>{form.watch("kind") === kind ? "✓ " : ""}{kindLabels[kind]}</button>)}</div>{errorText("kind") && <p className="mt-1 text-sm text-expense" id="kind-error">{errorText("kind")}</p>}</fieldset><label className="mt-4 block text-sm font-medium" htmlFor="amountToman">مبلغ به تومان<Input aria-describedby={errorText("amountToman") ? "amountToman-error" : undefined} aria-invalid={errorText("amountToman") ? true : undefined} className="mt-2" id="amountToman" type="number" {...form.register("amountToman", { valueAsNumber: true })} />{errorText("amountToman") && <span className="mt-1 block text-sm text-expense" id="amountToman-error">{errorText("amountToman")}</span>}</label><Controller name="occurredAt" control={form.control} render={({ field }) => <label className="mt-4 block text-sm font-medium">تاریخ و ساعت<DatePicker className="mt-2" defaultDate={field.value ? jalaliPartsFromIso(field.value) : null} locale="fa" minuteStep={1} onChange={(_, date) => { if (date.precision === "datetime") field.onChange(jalaliToIso(date.year, date.month, date.day, date.hour, date.minute)); }} precision="datetime" system="jalali" /></label>} /><label className="mt-4 block text-sm font-medium" htmlFor="note">توضیح<Textarea aria-describedby={errorText("note") ? "note-error" : undefined} aria-invalid={errorText("note") ? true : undefined} className="mt-2 min-h-20" id="note" {...form.register("note")} />{errorText("note") && <span className="mt-1 block text-sm text-expense" id="note-error">{errorText("note")}</span>}</label><details className="mt-4 text-sm"><summary className="cursor-pointer text-primary">مشاهده پیام اصلی</summary><p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-muted p-3 leading-7">{draft.originalMessage}</p></details>{mutation.isError && <p className="mt-3 rounded-lg bg-expense/10 p-3 text-sm text-expense" role="alert">تأیید تراکنش انجام نشد. اطلاعات واردشده حفظ شده است.</p>}<div className="mt-4 flex gap-2"><Button aria-label="تأیید تراکنش" disabled={mutation.isPending || reject.isPending} className="flex-1" type="submit">{mutation.isPending ? "در حال ذخیره" : "تأیید و بعدی"}</Button><Button disabled={mutation.isPending || reject.isPending} onClick={() => { if (window.confirm("این پیش‌نویس حذف شود؟")) reject.mutate(); }} type="button" variant="outline">نادیده گرفتن</Button></div></form>;
}

export function EnrichmentView() {
  const { data, isPending, isError, refetch } = useQuery(enrichmentQuery);
  const [index, setIndex] = useState(0);
  if (isPending) return <p className="text-sm text-muted-foreground" role="status">در حال دریافت پیش‌نویس‌ها...</p>;
  if (isError) return <div role="alert"><p className="text-sm text-expense">پیش‌نویس‌ها بارگذاری نشدند.</p><Button className="mt-3" onClick={() => void refetch()} variant="secondary">تلاش دوباره</Button></div>;
  if (!data?.drafts.length) return <div className="grid min-h-72 place-content-center text-center"><h2 className="font-bold">همه تراکنش‌ها بررسی شده‌اند</h2><p className="mt-2 text-sm text-muted-foreground">پیام‌های جدید اینجا نمایش داده می‌شوند.</p></div>;
  const safeIndex = Math.min(index, data.drafts.length - 1);
  return <div aria-live="polite" className="space-y-4"><DraftForm draft={data.drafts[safeIndex]} position={safeIndex + 1} total={data.drafts.length} onAdvance={() => setIndex(0)} /></div>;
}
