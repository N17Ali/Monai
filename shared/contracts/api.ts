import { z } from "zod";
import { transactionSchema } from "./transaction";

export const transactionListResponseSchema = z.object({ transactions: z.array(transactionSchema) });
export const enrichmentListResponseSchema = z.object({ drafts: z.array(transactionSchema), count: z.number().int() });
export const importResponseSchema = z.object({
  status: z.enum(["draft_created", "duplicate", "sensitive_blocked", "database_error"]),
  id: z.string().optional(),
});

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}
