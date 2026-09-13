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

// The kinds a user can pick in the manual and enrichment forms. Defined once so
// both forms and their defaulting rule cannot drift apart.
export const editableTransactionKinds = ["expense", "income", "transfer_out", "transfer_in"] as const;
export type EditableTransactionKind = (typeof editableTransactionKinds)[number];

const incomingKinds: readonly TransactionKind[] = ["income", "refund", "transfer_in"];
const outgoingKinds: readonly TransactionKind[] = ["expense", "fee", "cash_withdrawal"];

export type TransactionDirection = "in" | "out" | "neutral";

// The single sign rule for a financial kind: transfers and unknown kinds are
// neutral and never count as income or spending. Both the transactions list and
// the monthly totals read this, so they cannot classify a kind differently.
export function transactionDirection(kind: TransactionKind): TransactionDirection {
  if (incomingKinds.includes(kind)) return "in";
  if (outgoingKinds.includes(kind)) return "out";
  return "neutral";
}

export function editableKindOf(kind: TransactionKind): EditableTransactionKind {
  return (editableTransactionKinds as readonly string[]).includes(kind) ? (kind as EditableTransactionKind) : "expense";
}

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
