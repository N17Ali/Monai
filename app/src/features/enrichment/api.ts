import { queryOptions } from "@tanstack/react-query";
import { enrichmentListResponseSchema } from "@shared/contracts/api";
import { api } from "@/shared/api/client";

export const enrichmentKeys = { all: ["enrichment"] as const };
export const enrichmentQuery = queryOptions({
  queryKey: enrichmentKeys.all,
  queryFn: async () => enrichmentListResponseSchema.parse(await api<unknown>("/api/enrichment")),
});
