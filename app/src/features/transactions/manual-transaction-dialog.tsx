import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DatePicker } from "@jalali-js/react";
import { editableTransactionKinds, kindLabels } from "@shared/contracts/transaction";
import { jalaliToIso, nowJalaliTehran } from "@shared/parsing/jalali";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useManualTransaction } from "@/features/imports/capture";

const kinds = editableTransactionKinds;

type PickedDateTime = { year: number; month: number; day: number; hour: number; minute: number };

const jalaliEntrySchema = z.object({
  kind: z.enum(kinds),
  amountToman: z.number().positive("مبلغ باید بیشتر از صفر باشد"),
  occurredAt: z.custom<PickedDateTime>((value) => value != null),
  note: z.string().trim().max(300),
});

type JalaliEntryInput = z.infer<typeof jalaliEntrySchema>;

export function ManualForm({ onDone }: { onDone: () => void }) {
  const now = nowJalaliTehran();
  const form = useForm<JalaliEntryInput>({ resolver: zodResolver(jalaliEntrySchema), defaultValues: { kind: "expense", amountToman: 0, occurredAt: { year: now.jy, month: now.jm, day: now.jd, hour: now.hour, minute: now.minute }, note: "" } });
  const mutation = useManualTransaction();
  const submit = form.handleSubmit((values) => {
    const picked = values.occurredAt;
    mutation.mutate({ kind: values.kind, amountToman: values.amountToman, occurredAt: jalaliToIso(picked.year, picked.month, picked.day, picked.hour, picked.minute), note: values.note }, { onSuccess: onDone });
  });
  return <form className="mt-5 space-y-4" onSubmit={submit}><Controller name="kind" control={form.control} render={({ field }) => <div className="grid grid-cols-2 gap-2">{kinds.map((kind) => <button className={`min-h-12 rounded-lg border ${field.value === kind ? "border-primary bg-primary-soft text-primary" : "border-border"}`} key={kind} type="button" onClick={() => field.onChange(kind)}>{kindLabels[kind]}</button>)}</div>} /><label className="block text-sm font-medium">مبلغ به تومان<Input className="mt-2" inputMode="numeric" placeholder="مثلاً ۴۵۰۰۰" type="number" {...form.register("amountToman", { valueAsNumber: true })} /></label><Controller name="occurredAt" control={form.control} render={({ field }) => <div><span className="block text-sm font-medium">تاریخ و ساعت</span><DatePicker className="mt-2" defaultDate={field.value ? { precision: "datetime", system: "jalali", year: field.value.year, month: field.value.month, day: field.value.day, hour: field.value.hour, minute: field.value.minute, second: 0, millisecond: 0 } : null} locale="fa" minuteStep={1} onChange={(_, date) => { if (date.precision === "datetime") field.onChange({ year: date.year, month: date.month, day: date.day, hour: date.hour, minute: date.minute }); }} precision="datetime" system="jalali" /></div>} /><p className="text-sm text-expense">{form.formState.errors.amountToman?.message}</p><label className="block text-sm font-medium">توضیح<Textarea className="mt-2 min-h-20" {...form.register("note")} /></label><Button disabled={mutation.isPending} className="w-full" type="submit">ثبت تراکنش</Button></form>;
}

export function ManualTransactionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  return <Dialog onOpenChange={onOpenChange} open={open}><DialogContent><DialogHeader><DialogTitle>ثبت دستی تراکنش</DialogTitle></DialogHeader><ManualForm onDone={() => onOpenChange(false)} /></DialogContent></Dialog>;
}
