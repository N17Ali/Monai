import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, TimePicker } from "@jalali-js/react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { kindLabels, type EditableTransactionKind } from "@shared/contracts/transaction";
import { jalaliToIso, nowJalaliTehran } from "@shared/parsing/jalali";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const kinds = ["expense", "income", "transfer_out", "transfer_in"] as const;
const amountFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function amountDigits(value: string) {
  const latinDigits = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  return latinDigits.replace(/\D/g, "");
}

type PickedDateTime = { year: number; month: number; day: number; hour: number; minute: number };

const persianNumber = new Intl.NumberFormat("fa-IR", { useGrouping: false });

function DateTimePicker({ value, onChange }: { value: PickedDateTime; onChange: (value: PickedDateTime) => void }) {
  const [open, setOpen] = useState(false);
  const [portalHost, setPortalHost] = useState<Element | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const display = `${persianNumber.format(value.year)}/${persianNumber.format(value.month)}/${persianNumber.format(value.day)} ${persianNumber.format(value.hour).padStart(2, "۰")}:${persianNumber.format(value.minute).padStart(2, "۰")}`;

  function show() {
    setPortalHost(buttonRef.current?.closest('[data-slot="drawer-viewport"]') ?? document.body);
    setOpen(true);
  }

  return <>
    <button aria-expanded={open} aria-haspopup="dialog" className="w-full rounded-[var(--jalali-radius)] border border-border bg-surface px-3 py-2.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={show} ref={buttonRef} type="button">{display}</button>
    {open && portalHost && createPortal(<div className="pointer-events-auto fixed inset-0 z-[70] grid place-items-center bg-black/30 p-4" onPointerDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div aria-label="انتخاب تاریخ و ساعت" className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-xl" data-jalali-datepicker-root dir="rtl" role="dialog">
        <Calendar locale="fa" onSelect={(date) => onChange({ ...value, year: date.year, month: date.month, day: date.day })} system="jalali" value={{ precision: "date", system: "jalali", year: value.year, month: value.month, day: value.day }} />
        <TimePicker className="mt-4" locale="fa" minuteStep={1} onChange={(time) => onChange({ ...value, hour: time.hour, minute: time.minute })} value={{ hour: value.hour, minute: value.minute }} />
        <Button className="mt-4 w-full" onClick={() => setOpen(false)} type="button">تأیید</Button>
      </div>
    </div>, portalHost)}
  </>;
}

const formSchema = z.object({
  kind: z.enum(kinds),
  amountToman: z.number().positive("مبلغ باید بیشتر از صفر باشد"),
  occurredAt: z.custom<PickedDateTime>((value) => value != null, "تاریخ را وارد کنید"),
  note: z.string().trim().max(300),
});

export type TransactionFormValues = z.infer<typeof formSchema>;
export type TransactionFormSubmit = {
  kind: EditableTransactionKind;
  amountToman: number;
  occurredAt: string;
  note: string;
};

export function transactionFormDate(iso: string): PickedDateTime {
  const date = nowJalaliTehran(new Date(iso));
  return { year: date.jy, month: date.jm, day: date.jd, hour: date.hour, minute: date.minute };
}

export function newTransactionFormValues(): TransactionFormValues {
  const now = nowJalaliTehran();
  return { kind: "expense", amountToman: 0, occurredAt: { year: now.jy, month: now.jm, day: now.jd, hour: now.hour, minute: now.minute }, note: "" };
}

export function TransactionForm({ defaultValues, resetKey, pending, submitLabel, onSubmit }: {
  defaultValues: TransactionFormValues;
  resetKey: string;
  pending: boolean;
  submitLabel: string;
  onSubmit: (values: TransactionFormSubmit) => void;
}) {
  const form = useForm<TransactionFormValues>({ resolver: zodResolver(formSchema), defaultValues });
  const submit = form.handleSubmit((values) => {
    const picked = values.occurredAt;
    onSubmit({
      kind: values.kind,
      amountToman: values.amountToman,
      occurredAt: jalaliToIso(picked.year, picked.month, picked.day, picked.hour, picked.minute),
      note: values.note,
    });
  });

  return <form aria-busy={pending} className="mt-5" onSubmit={submit}>
    <fieldset className="space-y-4 disabled:opacity-70" disabled={pending}>
    <Controller name="kind" control={form.control} render={({ field }) => <fieldset>
      <legend className="mb-2 text-sm font-medium">نوع تراکنش</legend>
      <div className="grid grid-cols-2 gap-2">
        {kinds.map((kind) => <button aria-pressed={field.value === kind} className={`min-h-12 rounded-lg border ${field.value === kind ? "border-primary bg-primary-soft text-primary" : "border-border"}`} key={kind} type="button" onClick={() => field.onChange(kind)}>{field.value === kind ? "✓ " : ""}{kindLabels[kind]}</button>)}
      </div>
    </fieldset>} />
    <Controller name="amountToman" control={form.control} render={({ field }) => <label className="block text-sm font-medium">مبلغ به تومان
      <Input className="mt-2 text-start" dir="ltr" inputMode="numeric" placeholder="45,000" type="text" value={Number.isFinite(field.value) && field.value > 0 ? amountFormatter.format(field.value) : ""} onBlur={field.onBlur} onChange={(event) => { const digits = amountDigits(event.target.value); field.onChange(digits ? Number(digits) : Number.NaN); }} ref={field.ref} />
    </label>} />
    {form.formState.errors.amountToman?.message && <p className="text-sm text-expense">{form.formState.errors.amountToman.message}</p>}
    <Controller name="occurredAt" control={form.control} render={({ field }) => <div>
      <span className="block text-sm font-medium">تاریخ و ساعت</span>
      <div className="mt-2"><DateTimePicker key={resetKey} onChange={field.onChange} value={field.value} /></div>
    </div>} />
    {form.formState.errors.occurredAt?.message && <p className="text-sm text-expense">{form.formState.errors.occurredAt.message}</p>}
    <label className="block text-sm font-medium">توضیح
      <Textarea className="mt-2 min-h-20" {...form.register("note")} />
    </label>
    <Button className="w-full" type="submit">{pending ? "در حال ذخیره..." : submitLabel}</Button>
    </fieldset>
  </form>;
}
