// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "@shared/contracts/transaction";

const state = vi.hoisted(() => ({
  pages: [] as { transactions: Transaction[]; nextCursor: string | null }[],
}));

vi.mock("@/shared/api/client", () => ({
  api: (path: string) => {
    const cursor = new URLSearchParams(path.split("?")[1] ?? "").get("cursor");
    const page = cursor ? state.pages[Number(cursor)] : state.pages[0];
    return Promise.resolve(page ?? { transactions: [], nextCursor: null });
  },
}));

const { TransactionsView } = await import("@/features/transactions/transactions-view");

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(), source: "clipboard", status: "verified", kind: "expense", amountRial: 450000,
    occurredAt: new Date(Date.now() - 60_000).toISOString(), sourceDateText: null, dateWasInferred: false,
    bankId: "tejarat", accountId: null, balanceAfterRial: null, bankDescription: null, userNote: null,
    categoryId: null, originalMessage: null, ...overrides,
  };
}

class FakeIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds: ReadonlyArray<number> = [];
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe() {
    triggerScroll = () => this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

let triggerScroll: (() => void) | undefined;

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><TransactionsView /></QueryClientProvider>);
}

beforeEach(() => {
  state.pages = [];
  triggerScroll = undefined;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("transactions view", () => {
  it("shows the bank account number as a second line on cards that have one", async () => {
    state.pages = [{
      transactions: [
        transaction({ id: "with-account", userNote: "خرید فروشگاه افق", accountId: "6037991122334455" }),
        transaction({ id: "without-account", userNote: "خرید نان" }),
      ],
      nextCursor: null,
    }];
    renderView();
    await waitFor(() => expect(screen.getByText("خرید فروشگاه افق")).toBeInTheDocument());
    expect(screen.getByText(/شماره حساب/)).toBeInTheDocument();
    const accountNumber = screen.getByText("۶۰۳۷۹۹۱۱۲۲۳۳۴۴۵۵");
    expect(accountNumber).toBeInTheDocument();
    expect(accountNumber.closest("p")).not.toHaveClass("truncate");
    expect(screen.getAllByText(/شماره حساب/)).toHaveLength(1);
  });

  it("shows the complete transaction date and time without truncating it", async () => {
    state.pages = [{ transactions: [transaction({ id: "full-date", occurredAt: "2026-09-03T22:22:00.000Z" })], nextCursor: null }];
    renderView();
    const dateTime = await screen.findByText((text) => text.includes("شهریور") && text.includes("هزینه"));
    expect(dateTime).not.toHaveClass("truncate");
  });

  it("omits the source label from cards regardless of bank detection", async () => {
    state.pages = [{
      transactions: [
        transaction({ id: "sms-unknown-bank", source: "clipboard", userNote: "خرید با پیامک", bankId: null }),
        transaction({ id: "sms-known-bank", source: "clipboard", userNote: "خرید بانک‌دار", bankId: "tejarat" }),
      ],
      nextCursor: null,
    }];
    renderView();
    await waitFor(() => expect(screen.getByText("خرید با پیامک")).toBeInTheDocument());
    expect(screen.getByText("خرید بانک‌دار")).toBeInTheDocument();
    expect(screen.queryByText("ثبت دستی")).not.toBeInTheDocument();
    expect(screen.queryByText("tejarat")).not.toBeInTheDocument();
    expect(screen.getAllByText(/هزینه/).length).toBeGreaterThanOrEqual(2);
  });

  it("loads the next page when the sentinel scrolls into view", async () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    state.pages = [
      { transactions: [transaction({ id: "page-1", userNote: "خرید صفحه یک" })], nextCursor: "1" },
      { transactions: [transaction({ id: "page-2", userNote: "خرید صفحه دو" })], nextCursor: null },
    ];
    renderView();
    await waitFor(() => expect(screen.getByText("خرید صفحه یک")).toBeInTheDocument());
    expect(screen.queryByText("خرید صفحه دو")).not.toBeInTheDocument();
    expect(triggerScroll).toBeDefined();
    triggerScroll!();
    await waitFor(() => expect(screen.getByText("خرید صفحه دو")).toBeInTheDocument());
    expect(screen.getByText("همه تراکنش‌ها نمایش داده شد.")).toBeInTheDocument();
  });
});
