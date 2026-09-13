import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { clipboardImportSchema } from "@shared/contracts/transaction";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { useClipboardImport } from "./capture";

export function ClipboardImportForm({ active, onDone }: { active: boolean; onDone: (next: "review" | "later") => void }) {
  const form = useForm({ resolver: zodResolver(clipboardImportSchema), defaultValues: { text: "" } });
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [clipboardMessage, setClipboardMessage] = useState("");
  const { mutation, created, reset } = useClipboardImport();

  async function readClipboard() {
    try {
      form.setValue("text", await navigator.clipboard.readText(), { shouldValidate: true });
      textRef.current?.focus();
    } catch {
      setClipboardMessage("دسترسی به کلیپ‌بورد ممکن نیست. پیام را دستی در کادر جای‌گذاری کن.");
      textRef.current?.focus();
    }
  }

  useEffect(() => {
    if (active && !form.getValues("text")) void readClipboard();
  }, [active]);

  if (created) return <div className="mt-4 space-y-3"><div className="rounded-lg bg-income/10 p-4" role="status"><h3 className="font-semibold">پیش‌نویس آماده بررسی است</h3><p className="mt-1 text-sm text-muted-foreground">تا زمانی که آن را تأیید نکنی، در گزارش‌ها نمایش داده نمی‌شود.</p></div><div className="flex gap-2"><Button className="flex-1" onClick={() => onDone("review")}>بررسی الآن</Button><Button className="flex-1" onClick={() => { reset(); form.reset(); onDone("later"); }} variant="outline">بعداً</Button></div></div>;
  return <form className="mt-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><Controller name="text" control={form.control} render={({ field, fieldState }) => <label className="block text-sm font-medium">متن پیام<Textarea {...field} ref={(node) => { textRef.current = node; field.ref(node); }} className="mt-2 min-h-40" placeholder="پیام بانکی را اینجا جای‌گذاری کنید" />{clipboardMessage && <span className="mt-2 block text-sm text-warning" role="status">{clipboardMessage}</span>}{field.value && <span className="mt-2 block text-sm text-income" role="status">پیام از کلیپ‌بورد خوانده شد</span>}{fieldState.error && <span className="mt-2 block text-sm text-expense">{fieldState.error.message}</span>}</label>} /><Button aria-busy={mutation.isPending || undefined} disabled={mutation.isPending} className="mt-4 w-full" type="submit">{mutation.isPending && <Spinner />}ذخیره پیش‌نویس</Button></form>;
}

export function ClipboardImportDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (value: boolean) => void; onCreated: () => void }) {
  return <Dialog onOpenChange={onOpenChange} open={open}><DialogContent><DialogHeader><DialogTitle>ورود پیام بانکی</DialogTitle><DialogDescription>پیام به‌صورت پیش‌نویس ذخیره می‌شود و قبل از گزارش‌ها باید تأیید شود.</DialogDescription></DialogHeader><ClipboardImportForm active={open} onDone={(next) => { onOpenChange(false); if (next === "review") onCreated(); }} /></DialogContent></Dialog>;
}
