import { expect, test } from "@playwright/test";

test.describe("shell layout", () => {
  test("keeps desktop navigation flush with the RTL edge", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    const sidebar = page.locator("aside");
    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    expect(1920 - (box!.x + box!.width)).toBeLessThanOrEqual(1);
  });

  test("opens the desktop capture panel beside its trigger", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const trigger = page.locator("aside").getByRole("button", { name: "ثبت تراکنش" });
    const triggerBox = await trigger.boundingBox();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(triggerBox!.x + 8);
    expect(Math.abs(dialogBox!.y + dialogBox!.height - (triggerBox!.y + triggerBox!.height))).toBeLessThan(80);
  });

  test("shows a tooltip for the header add action on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("header").getByRole("button", { name: "ثبت تراکنش" })).toHaveAttribute("title", "ثبت تراکنش");
  });
});

test.describe("mobile input and navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("labels mobile navigation under every icon", async ({ page }) => {
    await page.goto("/");
    for (const label of ["خانه", "تراکنش‌ها", "تکمیل اطلاعات", "گفت‌وگو", "تنظیمات"]) {
      await expect(page.locator("nav .mobile-nav-label").filter({ hasText: label })).toBeVisible();
    }
    await expect(page.locator("nav").getByRole("button", { name: "خانه" })).toHaveAttribute("aria-current", "page");
  });

  test("shows a visible label on the mobile header add action", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header").getByRole("button", { name: "ثبت تراکنش" })).toContainText("ثبت");
  });

  test("keeps form controls at 16px to prevent iOS focus zoom", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ثبت تراکنش" }).click();
    await page.getByRole("button", { name: "ثبت", exact: true }).click();
    const input = page.getByPlaceholder("مثلاً ۴۵۰۰۰");
    await expect(input).toBeVisible();
    expect(Number.parseFloat(await input.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);

    await page.locator("[data-jalali-datepicker-input]").click();
    const controls = page.locator("[data-jalali-datepicker-input], [data-jalali-timepicker-field]");
    const count = await controls.count();
    for (let index = 0; index < count; index += 1) {
      expect(Number.parseFloat(await controls.nth(index).evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    }
  });

  test("disables all zoom on mobile", async ({ page }) => {
    await page.goto("/");
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("maximum-scale=1");
    expect(viewport).toContain("user-scalable=no");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe("pan-x pan-y");
  });
});

test.describe("clipboard capture", () => {
  test("reads the clipboard once and has no redundant read action", async ({ page, browserName }) => {
    await page.addInitScript(() => {
      let calls = 0;
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText: async () => { calls += 1; return "بلو 418,000 ریال از حساب شما پرید."; } } });
      Object.defineProperty(window, "__clipboardCalls", { configurable: true, get: () => calls });
    });
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "ثبت تراکنش" }).click();
    await page.getByRole("button", { name: /خواندن پیام بانکی/ }).click();
    await expect(page.locator("textarea")).toHaveValue("بلو 418,000 ریال از حساب شما پرید.");
    await expect(page.getByRole("button", { name: /دوباره خواندن/ })).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & { __clipboardCalls: number }).__clipboardCalls)).toBe(1);
    // iOS WebKit ignores programmatic focus outside a user gesture, so the focus
    // handoff after reading is only asserted on engines that honor it.
    if (browserName !== "webkit") await expect(page.locator("textarea")).toBeFocused();
  });

  test("shows loading and failure feedback and preserves the entered message", async ({ page }) => {
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "ثبت تراکنش" }).click();
    await page.getByRole("button", { name: /خواندن پیام بانکی/ }).click();
    const textarea = page.getByPlaceholder("پیام بانکی را اینجا جای‌گذاری کنید");
    await textarea.fill("بلو 418,000 ریال از حساب شما پرید.");
    await page.route("**/api/imports/clipboard", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.abort();
    });
    const submit = page.getByRole("button", { name: "ذخیره پیش‌نویس" });
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute("aria-busy", "true");
    await expect(page.getByText("ثبت تراکنش انجام نشد")).toBeVisible({ timeout: 5000 });
    await expect(textarea).toHaveValue("بلو 418,000 ریال از حساب شما پرید.");
  });

  test("shows the draft handoff when the Worker API accepts a new SMS", async ({ page }) => {
    const uniqueMessage = `بلو 418,000 ریال از حساب شما پرید. تست ${Date.now()}`;
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "ثبت تراکنش" }).click();
    await page.getByRole("button", { name: /خواندن پیام بانکی/ }).click();
    await page.getByPlaceholder("پیام بانکی را اینجا جای‌گذاری کنید").fill(uniqueMessage);
    await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
    await expect(page.getByText("پیش‌نویس آماده بررسی است")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("تا زمانی که آن را تأیید نکنی، در گزارش‌ها نمایش داده نمی‌شود.")).toBeVisible();
  });

  test("takes a newly imported draft to enrichment from the handoff", async ({ page }) => {
    await page.route("**/api/imports/clipboard", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "draft_created", id: "draft-1" }) });
    });
    await page.route("**/api/enrichment", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ drafts: [], count: 0 }) });
    });
    await page.route(/\/api\/transactions(\?.*)?$/, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transactions: [] }) });
    });
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "ثبت تراکنش" }).click();
    await page.getByRole("button", { name: /خواندن پیام بانکی/ }).click();
    await page.getByPlaceholder("پیام بانکی را اینجا جای‌گذاری کنید").fill("بلو 418,000 ریال از حساب شما پرید.");
    await page.getByRole("button", { name: "ذخیره پیش‌نویس" }).click();
    await expect(page.getByText("پیش‌نویس آماده بررسی است")).toBeVisible();
    await page.getByRole("button", { name: "بررسی الآن" }).click();
    await expect(page.getByRole("main").getByText("همه تراکنش‌ها بررسی شده‌اند")).toBeVisible();
  });
});
