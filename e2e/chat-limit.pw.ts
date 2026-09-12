import { expect, test } from "@playwright/test";

const messagesUrl = /\/api\/chat\/messages(\?.*)?$/;

test.describe("conversation message limit", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("disables the composer at the limit and recovers with a new conversation", async ({ page }) => {
    const history = Array.from({ length: 25 }, (_, index) => [
      { id: `u${index}`, role: "user", parts: [{ type: "text", text: `سؤال ${index}` }] },
      { id: `a${index}`, role: "assistant", parts: [{ type: "text", text: `پاسخ ${index}`, state: "done" }] },
    ]).flat();
    await page.route(messagesUrl, (route) => {
      const conversationId = new URL(route.request().url()).searchParams.get("conversationId");
      const body = conversationId ? { messages: [] } : { messages: history };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto("/?view=chat");
    const textarea = page.getByPlaceholder("مثلاً این ماه چقدر خرج کردم؟");
    await expect(textarea).toBeDisabled();
    await expect(page.getByText(/به سقف ۵۰ پیام رسیده است/)).toBeVisible();
    await page.getByRole("status").getByRole("button", { name: "گفت‌وگوی جدید" }).click();
    await expect(textarea).toBeEnabled();
    await expect(page.getByText(/به سقف ۵۰ پیام رسیده است/)).toHaveCount(0);
  });
});
