import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { transactionListResponseSchema } from "@shared/contracts/api";
import { api } from "@/shared/api/client";

export const TRANSACTIONS_PAGE_SIZE = 50;

export const transactionKeys = { all: ["transactions"] as const };
export const transactionsQuery = queryOptions({
  queryKey: transactionKeys.all,
  queryFn: async () => transactionListResponseSchema.parse(await api<unknown>("/api/transactions")),
});

export function transactionsInfiniteQuery(limit = TRANSACTIONS_PAGE_SIZE) {
  return infiniteQueryOptions({
    queryKey: [...transactionKeys.all, "pages", limit],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (pageParam) params.set("cursor", pageParam);
      const payload = transactionListResponseSchema.parse(await api<unknown>(`/api/transactions?${params}`));
      return { transactions: payload.transactions, nextCursor: payload.nextCursor ?? null };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
