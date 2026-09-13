import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { importResponseSchema } from "@shared/contracts/api";
import type { ManualTransactionInput } from "@shared/contracts/transaction";
import { enrichmentKeys } from "@/features/enrichment/api";
import { transactionKeys } from "@/features/transactions/api";
import { api } from "@/shared/api/client";

export type CaptureStep = "choose" | "clipboard" | "manual";

// The capture flow's step machine. The shell owns one instance; the drawer and
// dialog containers render whichever step it reports, and the forms submit
// through the hooks below.
export function useCaptureFlow(onReview: () => void) {
  const [step, setStep] = useState<CaptureStep | null>(null);
  return {
    step,
    setStep,
    open: () => setStep("choose"),
    close: () => setStep(null),
    choose: (choice: "clipboard" | "manual") => setStep(choice),
    back: () => setStep("choose"),
    review: () => {
      setStep(null);
      onReview();
    },
  };
}

// One clipboard-import submission behind every container: POST, enrichment
// invalidation, and the client-facing status toasts. `created` drives the
// post-import handoff, so both containers show the same next step.
export function useClipboardImport() {
  const queryClient = useQueryClient();
  const [created, setCreated] = useState(false);
  const mutation = useMutation({
    mutationFn: (values: { text: string }) => api<unknown>("/api/imports/clipboard", { method: "POST", body: JSON.stringify(values) }).then(importResponseSchema.parse),
    onSuccess: async (result) => {
      if (result.status === "duplicate") return toast.info("این پیام قبلاً وارد شده است");
      if (result.status === "sensitive_blocked") return toast.error("پیام‌های حاوی رمز ذخیره نمی‌شوند");
      if (result.status === "draft_created") {
        await queryClient.invalidateQueries({ queryKey: enrichmentKeys.all });
        toast.success("تراکنش برای تکمیل اطلاعات آماده شد");
        setCreated(true);
      }
    },
    onError: () => toast.error("ثبت تراکنش انجام نشد"),
  });
  return { mutation, created, reset: () => setCreated(false) };
}

// Manual entry is trusted input, so it lands as a verified transaction and only
// the transactions list needs invalidating.
export function useManualTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ManualTransactionInput) => api("/api/transactions/manual", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      toast.success("تراکنش ثبت شد");
    },
    onError: () => toast.error("ثبت تراکنش انجام نشد"),
  });
}
