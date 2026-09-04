import { queryOptions } from "@tanstack/react-query";
import { transactionListResponseSchema } from "@shared/contracts/api";
import { api } from "@/shared/api/client";

export const transactionKeys = { all: ["transactions"] as const };
export const transactionsQuery = queryOptions({
  queryKey: transactionKeys.all,
  queryFn: async () => transactionListResponseSchema.parse(await api<unknown>("/api/transactions")),
});
