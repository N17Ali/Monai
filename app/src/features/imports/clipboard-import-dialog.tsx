import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { clipboardImportSchema } from "@shared/contracts/transaction";
import { importResponseSchema } from "@shared/contracts/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/shared/api/client";
import { enrichmentKeys } from "@/features/enrichment/api";

export function ClipboardImportForm({ active, onDone }: { active: boolean; onDone: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm({ resolver: zodResolver(clipboardImportSchema), defaultValues: { text: "" } });
  const mutation = useMutation({
    mutationFn: (values: { text: string }) => api<unknown>("/api/imports/clipboard", { method: "POST", body: JSON.stringify(values) }).then(importResponseSchema.parse),
    onSuccess: async (result) => {
      if (result.status === "duplicate") return toast.info("این پیام قبلاً وارد شده است");
      if (result.status === "sensitive_blocked") return toast.error("پیام‌های حاوی رمز ذخیره نمی‌شوند");
      if (result.status === "draft_created") {
        await queryClient.invalidateQueries({ queryKey: enrichmentKeys.all });
        toast.success("تراکنش برای تکمیل اطلاعات آماده شد");
        form.reset();
        onDone();
      }
    },
    onError: () => toast.error("ثبت تراکنش انجام نشد"),
  });

  async function readClipboard() {
    try { form.setValue("text", await navigator.clipboard.readText(), { shouldValidate: true }); }
    catch { toast.info("پیام را در کادر جای‌گذاری کنید"); }
  }

  useEffect(() => {
    if (active && !form.getValues("text")) void readClipboard();
  }, [active]);

  return <form className="mt-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><Controller name="text" control={form.control} render={({ field, fieldState }) => <label className="block text-sm font-medium">متن پیام<Textarea className="mt-2 min-h-40" placeholder="پیام بانکی را اینجا جای‌گذاری کنید" {...field} />{fieldState.error && <span className="mt-2 block text-sm text-expense">{fieldState.error.message}</span>}</label>} /><Button aria-busy={mutation.isPending || undefined} disabled={mutation.isPending} className="mt-4 w-full" type="submit">{mutation.isPending && <Spinner />}تبدیل به تراکنش</Button></form>;
}

export function ClipboardImportDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (value: boolean) => void; onCreated: () => void }) {
  return <Dialog onOpenChange={onOpenChange} open={open}><DialogContent><DialogHeader><DialogTitle>ورود پیام بانکی</DialogTitle><DialogDescription>پیام به‌صورت پیش‌نویس ذخیره می‌شود و قبل از گزارش‌ها باید تأیید شود.</DialogDescription></DialogHeader><ClipboardImportForm active={open} onDone={() => { onOpenChange(false); onCreated(); }} /></DialogContent></Dialog>;
}
