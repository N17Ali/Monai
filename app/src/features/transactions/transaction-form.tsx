import { zodResolver } from "@hookform/resolvers/zod";
import { DatePicker } from "@jalali-js/react";
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
      <DatePicker key={resetKey} className="mt-2" defaultDate={{ precision: "datetime", system: "jalali", year: field.value.year, month: field.value.month, day: field.value.day, hour: field.value.hour, minute: field.value.minute, second: 0, millisecond: 0 }} locale="fa" minuteStep={1} onChange={(_, date) => { if (date.precision === "datetime") field.onChange({ year: date.year, month: date.month, day: date.day, hour: date.hour, minute: date.minute }); }} precision="datetime" system="jalali" />
    </div>} />
    {form.formState.errors.occurredAt?.message && <p className="text-sm text-expense">{form.formState.errors.occurredAt.message}</p>}
    <label className="block text-sm font-medium">توضیح
      <Textarea className="mt-2 min-h-20" {...form.register("note")} />
    </label>
    <Button className="w-full" type="submit">{pending ? "در حال ذخیره..." : submitLabel}</Button>
    </fieldset>
  </form>;
}
