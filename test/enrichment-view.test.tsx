// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "@shared/contracts/transaction";
import { EnrichmentView } from "@/features/enrichment/enrichment-view";

vi.mock("@/shared/api/client", () => ({
  api: vi.fn().mockResolvedValue({
    drafts: [
      {
        id: "draft-1",
        source: "clipboard",
        status: "needs_review",
        kind: "unknown",
        amountRial: 450000,
        occurredAt: "2024-07-23T11:00:00.000Z",
        bankId: "tejarat",
        accountId: null,
        balanceAfterRial: null,
        bankDescription: null,
        userNote: null,
        categoryId: null,
        originalMessage: "بانک تجارت پرداخت ۴۵۰ ۰۰۰ ریال ۱۴۰۳/۰۵/۰۲-۱۴:۳۰ انجام شد.",
        sourceDateText: "۱۴۰۳/۰۵/۰۲-۱۴:۳۰",
        dateWasInferred: false,
      } satisfies Transaction,
    ],
    count: 1,
  }),
}));

function renderEnrichmentView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><EnrichmentView /></QueryClientProvider>);
}

afterEach(cleanup);

describe("enrichment view", () => {
  it("prefills the amount extracted from the SMS", async () => {
    renderEnrichmentView();
    await waitFor(() => expect(screen.getByRole("button", { name: "تأیید تراکنش" })).toBeInTheDocument());
    expect((screen.getByLabelText("مبلغ به تومان") as HTMLInputElement).value).toBe("45000");
  });

  it("shows the extracted date so the user can verify it", async () => {
    renderEnrichmentView();
    await waitFor(() => expect(screen.getByRole("button", { name: "تأیید تراکنش" })).toBeInTheDocument());
    expect(screen.getByText("تاریخ استخراج‌شده")).toBeInTheDocument();
    expect(screen.getByText("۱۴۰۳/۰۵/۰۲-۱۴:۳۰")).toBeInTheDocument();
  });
});
