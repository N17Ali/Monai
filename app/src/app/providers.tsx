import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { useState, type PropsWithChildren } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: PropsWithChildren) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }));
  return <NuqsAdapter><QueryClientProvider client={client}>{children}<Toaster position="top-center" richColors /></QueryClientProvider></NuqsAdapter>;
}
