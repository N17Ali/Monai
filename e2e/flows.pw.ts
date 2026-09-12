import { expect, test } from "@playwright/test";

function draftFixture(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

const transactionsUrl = /\/api\/transactions(\?.*)?$/;

test.describe("import and review flows", () => {
  test("duplicate SMS shows the duplicate state and keeps the message", async ({ page }) => {
    await page.route("**/api/imports/clipboard", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "duplicate" }) }),
    );
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "ثبت تراکنش" }).click();
    await page.getByRole("button", { name: "خواندن پیام بانکی" }).click();
    const textarea = page.getByPlaceholder("پیام بانکی را اینجا جای‌گذاری کنید");
    await textarea.fill("بلو 418,000 ریال از حساب شما پرید.");
    await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
    await expect(page.getByText("این پیام قبلاً وارد شده است")).toBeVisible({ timeout: 5000 });
    await expect(textarea).toHaveValue("بلو 418,000 ریال از حساب شما پرید.");
    await expect(page.getByText("پیش‌نویس آماده بررسی است")).toHaveCount(0);
  });

  test("sensitive SMS is blocked without creating a draft", async ({ page }) => {
    await page.route("**/api/imports/clipboard", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "sensitive_blocked" }) }),
    );
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "ثبت تراکنش" }).click();
    await page.getByRole("button", { name: "خواندن پیام بانکی" }).click();
    await page.getByPlaceholder("پیام بانکی را اینجا جای‌گذاری کنید").fill("رمز دوم شما: 123456");
    await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
    await expect(page.getByText("پیام‌های حاوی رمز ذخیره نمی‌شوند", { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("پیش‌نویس آماده بررسی است")).toHaveCount(0);
  });

  test("rejects a draft from the review queue", async ({ page }) => {
    let deleteRequested = false;
    await page.route("**/api/enrichment", async (route) => {
      const body = deleteRequested ? { drafts: [], count: 0 } : { drafts: [draftFixture()], count: 1 };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.route("**/api/enrichment/draft-1", async (route) => {
      if (route.request().method() === "DELETE") {
        deleteRequested = true;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "rejected" }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "verified" }) });
    });
    page.on("dialog", (dialog) => void dialog.accept());
    await page.goto("/?view=enrichment");
    await expect(page.getByText("تراکنش ۱ از ۱")).toBeVisible();
    await page.getByRole("button", { name: "نادیده گرفتن" }).click();
    await expect(page.getByText("همه تراکنش‌ها بررسی شده‌اند")).toBeVisible({ timeout: 5000 });
    expect(deleteRequested).toBe(true);
  });

  test("empty transactions state offers import and manual actions", async ({ page }) => {
    // Desktop dialogs expose an explicit close button; the mobile drawers close by swipe instead.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route(transactionsUrl, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transactions: [] }) }),
    );
    await page.goto("/?view=transactions");
    await expect(page.getByText("هنوز تراکنش تأییدشده‌ای نیست")).toBeVisible();

    await page.getByRole("button", { name: "ورود پیام بانکی" }).click();
    const clipboardDialog = page.getByRole("dialog").filter({ hasText: "ورود پیام بانکی" });
    await expect(clipboardDialog.getByText("پیام به‌صورت پیش‌نویس ذخیره می‌شود و قبل از گزارش‌ها باید تأیید شود.")).toBeVisible();
    await clipboardDialog.getByRole("button", { name: "بستن" }).click();

    await page.getByRole("button", { name: "ثبت دستی" }).click();
    await expect(page.getByRole("dialog").getByPlaceholder("مثلاً ۴۵۰۰۰")).toBeVisible();
  });

  test("shows the bank account number as a second line on cards", async ({ page }) => {
    await page.route(transactionsUrl, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ transactions: [draftFixture({ id: "verified-1", status: "verified", userNote: "برداشت از حساب", accountId: "6037991122334455" })], nextCursor: null }),
      }),
    );
    await page.goto("/?view=transactions");
    await expect(page.getByText("برداشت از حساب")).toBeVisible();
    await expect(page.getByText(/شماره حساب/)).toBeVisible();
    await expect(page.getByText("6037991122334455")).toBeVisible();
  });

  test("loads older transactions when the user scrolls to the bottom", async ({ page }) => {
    const all = Array.from({ length: 60 }, (_, index) =>
      draftFixture({ id: `tx-${index}`, status: "verified", kind: "expense", userNote: `خرید شماره ${index}`, occurredAt: "2024-05-01T10:00:00.000Z" }),
    );
    await page.route(transactionsUrl, async (route) => {
      const url = new URL(route.request().url());
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const cursor = url.searchParams.get("cursor");
      const start = cursor ? all.findIndex((item) => `${item.occurredAt}|${item.id}` === cursor) + 1 : 0;
      const page = all.slice(start, start + limit);
      const last = page.at(-1);
      const nextCursor = page.length === limit && last ? `${last.occurredAt}|${last.id}` : null;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transactions: page, nextCursor }) });
    });
    await page.goto("/?view=transactions");
    await expect(page.getByText("خرید شماره 0")).toBeVisible();
    await expect(page.getByText("خرید شماره 49")).toBeVisible();
    await expect(page.getByText("خرید شماره 59")).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByText("خرید شماره 59")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("همه تراکنش‌ها نمایش داده شد.")).toBeVisible();
  });
});
