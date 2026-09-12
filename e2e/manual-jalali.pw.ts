import { expect, test } from "@playwright/test";

test.describe("manual transaction jalali entry", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("picks a Jalali date and time and stores the correct Tehran instant", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ثبت تراکنش" }).first().click();
    await page.getByRole("button", { name: "ثبت", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("مثلاً ۴۵۰۰۰").fill("1400000");

    await dialog.locator("[data-jalali-datepicker-input]").click();
    await dialog.locator('[data-jalali-calendar-day][aria-label="۱۳ شهریور ۱۴۰۵"]').click();
    await dialog.locator('[data-jalali-timepicker-field="hour"]').selectOption("1");
    await dialog.locator('[data-jalali-timepicker-field="minute"]').selectOption("52");
    await dialog.locator("[data-jalali-datepicker-input]").click();
    await expect(dialog.locator("[data-jalali-datepicker-input]")).toHaveValue("۱۳ شهریور ۱۴۰۵ ۰۱:۵۲");

    await dialog.getByRole("button", { name: "ثبت تراکنش" }).click();

    const response = await page.request.get("/api/transactions");
    const { transactions } = (await response.json()) as { transactions: Array<{ source: string; occurredAt: string; amountRial: number; kind: string }> };
    const created = transactions.find((item) => item.source === "manual");
    expect(created?.occurredAt).toBe("2026-09-03T22:22:00.000Z");
    expect(created?.amountRial).toBe(14_000_000);
    expect(created?.kind).toBe("expense");
  });
});
