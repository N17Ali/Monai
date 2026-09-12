import { z } from "zod";

export const transactionKindSchema = z.enum([
  "expense",
  "income",
  "transfer_out",
  "transfer_in",
  "refund",
  "fee",
  "cash_withdrawal",
  "unknown",
]);

export const transactionStatusSchema = z.enum(["needs_review", "verified", "rejected"]);
export const transactionSourceSchema = z.enum(["clipboard", "ios_shortcut", "manual"]);

export const transactionSchema = z.object({
  id: z.string(),
  source: transactionSourceSchema,
  status: transactionStatusSchema,
  kind: transactionKindSchema,
  amountRial: z.number().int().nonnegative(),
  occurredAt: z.iso.datetime(),
  sourceDateText: z.string().nullable(),
  dateWasInferred: z.boolean(),
  bankId: z.string().nullable(),
  accountId: z.string().nullable(),
  balanceAfterRial: z.number().int().nullable(),
  bankDescription: z.string().nullable(),
  userNote: z.string().nullable(),
  categoryId: z.string().nullable(),
  originalMessage: z.string().nullable(),
});

export const clipboardImportSchema = z.object({
  text: z.string().trim().min(1, "متن پیام را وارد کنید").max(5000),
});

export const manualTransactionSchema = z.object({
  kind: transactionKindSchema.exclude(["unknown"]),
  amountToman: z.number().positive("مبلغ باید بیشتر از صفر باشد"),
  occurredAt: z.string().min(1, "تاریخ را وارد کنید"),
  note: z.string().trim().max(300),
});

export const enrichmentUpdateSchema = z.object({
  kind: transactionKindSchema.exclude(["unknown"]),
  amountToman: z.number().positive("مبلغ را مشخص کنید"),
  note: z.string().trim().max(300),
  occurredAt: z.iso.datetime().optional(),
});

export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionKind = z.infer<typeof transactionKindSchema>;
export type ManualTransactionInput = z.infer<typeof manualTransactionSchema>;
export type EnrichmentUpdateInput = z.infer<typeof enrichmentUpdateSchema>;

export const kindLabels: Record<TransactionKind, string> = {
  expense: "هزینه",
  income: "درآمد",
  transfer_out: "انتقال خروجی",
  transfer_in: "انتقال ورودی",
  refund: "بازگشت وجه",
  fee: "کارمزد",
  cash_withdrawal: "برداشت نقدی",
  unknown: "نامشخص",
};
