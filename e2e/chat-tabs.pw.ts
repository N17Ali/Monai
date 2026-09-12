import { expect, test, type Page } from "@playwright/test";

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

function toAsciiDigits(text: string) {
  return text.replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)));
}

function faNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

async function maxTabNumber(page: Page) {
  const labels = await page.locator('[aria-label="فهرست گفت‌وگوها"] div button').allTextContents();
  return labels.reduce((max, label) => Math.max(max, Number(toAsciiDigits(label).match(/(\d+)/)?.[1] ?? 0)), 0);
}

test.describe("chat tabs", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("creates, names, hovers, and closes conversation tabs without reload", async ({ page }) => {
    await page.route("**/api/chat/messages", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ messages: [] }) }),
    );
    await page.goto("/?view=chat");
    const tabs = page.locator('[aria-label="فهرست گفت‌وگوها"]');
    await expect(tabs.locator("div").first()).toBeVisible();

    const newChat = page.getByRole("button", { name: "گفت‌وگوی جدید" });
    await expect(newChat).toHaveCount(1);
    await expect(newChat.locator("svg")).toHaveCount(1);

    const before = await maxTabNumber(page);
    expect(before).toBeGreaterThanOrEqual(1);

    await newChat.click();
    const createdName = `گفت‌وگوی ${faNumber(before + 1)}`;
    await expect(page.getByRole("button", { name: createdName, exact: true })).toBeVisible();

    const group = tabs.locator("div").first();
    const titleButton = group.locator("button").first();
    const closeButton = group.locator("button").nth(1);
    expect(await group.locator("button").count()).toBe(2);
    expect(await group.getAttribute("class")).toContain("hover:bg");
    expect(await titleButton.getAttribute("class")).toContain("hover:bg-transparent");
    expect(await closeButton.getAttribute("class")).toContain("hover:bg-transparent");

    await page.getByRole("button", { name: `بستن ${createdName}`, exact: true }).click();
    await expect(page.getByRole("button", { name: createdName })).toHaveCount(0);
  });
});
