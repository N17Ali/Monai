import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { transactionListResponseSchema } from "@shared/contracts/api";
import type { VerifiedTransactionUpdateInput } from "@shared/contracts/transaction";
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

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...values }: { id: string } & VerifiedTransactionUpdateInput) =>
      api(`/api/transactions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      toast.success("تراکنش ویرایش شد");
    },
    onError: () => toast.error("ویرایش تراکنش انجام نشد"),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      toast.success("تراکنش حذف شد");
    },
    onError: () => toast.error("حذف تراکنش انجام نشد"),
  });
}
