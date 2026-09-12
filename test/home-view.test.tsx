// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "@shared/contracts/transaction";

const state = vi.hoisted(() => ({
  drafts: [] as Transaction[],
  transactions: [] as Transaction[],
  failTransactions: false,
}));

vi.mock("@/shared/api/client", () => ({
  api: (path: string) => {
    if (path === "/api/enrichment") return Promise.resolve({ drafts: state.drafts, count: state.drafts.length });
    if (path === "/api/transactions") {
      if (state.failTransactions) return Promise.reject(new Error("failed"));
      return Promise.resolve({ transactions: state.transactions });
    }
    return Promise.reject(new Error(`unexpected path: ${path}`));
  },
}));

vi.mock("@/features/transactions/balance-flow-chart", () => ({
  BalanceFlowChart: () => <div data-testid="balance-flow-chart" />,
}));

const { Home } = await import("@/App");

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(), source: "manual", status: "verified", kind: "income", amountRial: 2000000,
    occurredAt: new Date(Date.now() - 60_000).toISOString(), sourceDateText: null, dateWasInferred: false,
    bankId: "tejarat", accountId: "a1", balanceAfterRial: 1000000, bankDescription: null, userNote: null,
    categoryId: null, originalMessage: null, ...overrides,
  };
}

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onCapture = vi.fn();
  const onEnrichment = vi.fn();
  const onTransactions = vi.fn();
  render(<QueryClientProvider client={queryClient}><Home onCapture={onCapture} onEnrichment={onEnrichment} onTransactions={onTransactions} /></QueryClientProvider>);
  return { onCapture, onEnrichment, onTransactions };
}

beforeEach(() => {
  state.drafts = [];
  state.transactions = [];
  state.failTransactions = false;
});

afterEach(cleanup);

describe("home states", () => {
  it("shows onboarding for a new user with no data", async () => {
    const { onCapture } = renderHome();
    await waitFor(() => expect(screen.getByText("اولین تراکنشت را وارد کن")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "ورود پیام بانکی" }));
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "بررسی تراکنش‌ها" })).not.toBeInTheDocument();
  });

  it("shows the review state when drafts are pending", async () => {
    state.drafts = [transaction({ status: "needs_review", kind: "unknown" })];
    const { onEnrichment } = renderHome();
    await waitFor(() => expect(screen.getByText("۱ تراکنش منتظر بررسی است")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "بررسی تراکنش‌ها" }));
    expect(onEnrichment).toHaveBeenCalledTimes(1);
  });

  it("shows verified-data summary, month-scoped metrics, and the chart", async () => {
    state.transactions = [
      transaction({ id: "t1", kind: "income", amountRial: 2000000, occurredAt: new Date(Date.now() - 60_000).toISOString() }),
      transaction({ id: "t2", kind: "expense", amountRial: 400000, occurredAt: new Date(Date.now() - 3 * 24 * 3600_000).toISOString() }),
    ];
    const { onTransactions } = renderHome();
    await waitFor(() => expect(screen.getByText("وضعیت مالی‌ات را بررسی کن")).toBeInTheDocument());
    expect(screen.getByText("درآمد این ماه")).toBeInTheDocument();
    expect(screen.getByText("هزینه این ماه")).toBeInTheDocument();
    expect(screen.getByText("خالص این ماه")).toBeInTheDocument();
    expect(screen.getByTestId("balance-flow-chart")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "مشاهده تراکنش‌ها" }));
    expect(onTransactions).toHaveBeenCalledTimes(1);
  });

  it("hides the review action when there are no pending drafts", async () => {
    state.transactions = [transaction({ id: "t1" })];
    renderHome();
    await waitFor(() => expect(screen.getByText("همه تراکنش‌ها بررسی شده‌اند")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "بررسی تراکنش‌ها" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ورود پیام جدید" })).toBeInTheDocument();
  });

  it("shows a load failure state when the data request fails", async () => {
    state.failTransactions = true;
    renderHome();
    await waitFor(() => expect(screen.getByText("اطلاعات مالی بارگذاری نشد.")).toBeInTheDocument());
  });
});
