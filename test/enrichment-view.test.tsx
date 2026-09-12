// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "@shared/contracts/transaction";
import { EnrichmentView } from "@/features/enrichment/enrichment-view";

const state = vi.hoisted(() => ({
  draft: {
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
}));

vi.mock("@/shared/api/client", () => ({
  api: vi.fn(async () => ({ drafts: [state.draft], count: 1 })),
}));

function renderEnrichmentView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><EnrichmentView /></QueryClientProvider>);
}

beforeEach(() => {
  state.draft = { ...state.draft, dateWasInferred: false, occurredAt: "2024-07-23T11:00:00.000Z" };
});

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

  it("offers an editable Jalali datetime prefilled with the draft date", async () => {
    renderEnrichmentView();
    await waitFor(() => expect(screen.getByRole("button", { name: "تأیید تراکنش" })).toBeInTheDocument());
    const picker = screen.getByLabelText("تاریخ و ساعت");
    expect(picker.getAttribute("data-jalali-datepicker-input")).not.toBeNull();
    expect((picker as HTMLInputElement).value).not.toBe("");
  });

  it("warns when the date was inferred from the message", async () => {
    state.draft = { ...state.draft, dateWasInferred: true };
    renderEnrichmentView();
    await waitFor(() => expect(screen.getByText("این تاریخ از متن پیام حدس زده شده است. لطفاً بررسی کن.")).toBeInTheDocument());
  });

  it("submits the draft date as an editable occurredAt value", async () => {
    renderEnrichmentView();
    await waitFor(() => expect(screen.getByRole("button", { name: "تأیید تراکنش" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "تأیید تراکنش" }));
    const { api } = await import("@/shared/api/client");
    await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalled());
    const call = vi.mocked(api).mock.calls.find(([path]) => path === "/api/enrichment/draft-1");
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ occurredAt: "2024-07-23T11:00:00.000Z" });
  });
});
