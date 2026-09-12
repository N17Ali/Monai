import { expect, test } from "@playwright/test";

const STREAM_HEADERS = {
  "content-type": "text/event-stream",
  "x-vercel-ai-ui-message-stream": "v1",
};

function sse(chunks: object[]) {
  return chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("");
}

function streamResponse(text: string) {
  return sse([
    { type: "start", messageId: "a1" },
    { type: "text-start", id: "p1" },
    { type: "text-delta", id: "p1", delta: text },
    { type: "text-end", id: "p1" },
    { type: "finish" },
  ]);
}

const emptyHistory = (status = 200) => ({
  status,
  contentType: "application/json" as const,
  body: JSON.stringify({ messages: [] }),
});

test.describe("polish and accessibility", () => {
  test("switches the theme and persists the choice", async ({ page }) => {
    await page.goto("/?view=settings");
    const toggle = page.getByRole("button", { name: "تغییر تم" });
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "تغییر تم" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("disables the waiting animation under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/chat/messages", (route) => route.fulfill(emptyHistory()));
    await page.route("**/api/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({ status: 200, headers: STREAM_HEADERS, body: streamResponse("پاسخ آزمون") });
    });
    await page.goto("/?view=chat");
    const textarea = page.getByPlaceholder("مثلاً این ماه چقدر خرج کردم؟");
    await textarea.fill("سلام");
    await page.getByRole("button", { name: "بپرس" }).click();
    const dots = page.locator(".dot-elastic");
    await dots.waitFor({ state: "attached" });
    expect(await dots.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  });

  test("navigates between views with the keyboard only", async ({ page }) => {
    await page.goto("/");
    let focused = false;
    for (let index = 0; index < 20 && !focused; index += 1) {
      await page.keyboard.press("Tab");
      focused = await page.evaluate(() => {
        const element = document.activeElement;
        return element?.closest("nav") != null && element.getAttribute("aria-label") === "تراکنش‌ها";
      });
    }
    expect(focused).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "تراکنش‌ها" })).toBeVisible();
    await expect(page).toHaveURL(/view=transactions/);
  });

  test("keeps the submit button width stable while answering", async ({ page }) => {
    await page.route("**/api/chat/messages", (route) => route.fulfill(emptyHistory()));
    await page.route("**/api/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({ status: 200, headers: STREAM_HEADERS, body: streamResponse("پاسخ آزمون") });
    });
    await page.goto("/?view=chat");
    const submit = page.getByRole("button", { name: "بپرس" });
    const before = (await submit.boundingBox())!.width;
    const textarea = page.getByPlaceholder("مثلاً این ماه چقدر خرج کردم؟");
    await textarea.fill("سلام");
    await submit.click();
    await expect(page.getByRole("button", { name: "در حال پاسخ" })).toBeVisible();
    const during = (await page.getByRole("button", { name: "در حال پاسخ" }).boundingBox())!.width;
    expect(during).toBe(before);
  });

  test("keeps chat tab touch targets at least 44px", async ({ page }) => {
    await page.route("**/api/chat/messages", (route) => route.fulfill(emptyHistory()));
    await page.goto("/?view=chat");
    const close = page.locator('[aria-label="فهرست گفت‌وگوها"] div button').nth(1);
    expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const newChat = page.getByRole("button", { name: "گفت‌وگوی جدید" });
    expect((await newChat.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});
