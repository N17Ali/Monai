import { expect, test, type Route } from "@playwright/test";

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

function emptyHistory(route: Route) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ messages: [] }) });
}

test.describe("chat page", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("shows the saved chat history with rich model messages", async ({ page }) => {
    await page.route("**/api/chat/messages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: [
            { id: "u1", role: "user", parts: [{ type: "text", text: "این ماه چقدر خرج کردم؟" }] },
            { id: "a1", role: "assistant", parts: [{ type: "step-start" }, { type: "text", text: "مجموع خرج این ماه **۱٬۲۰۰٬۰۰۰ تومان** بود.", state: "done" }] },
          ],
        }),
      });
    });
    await page.goto("/?view=chat");
    await expect(page.getByText("این ماه چقدر خرج کردم؟")).toBeVisible();
    await expect(page.getByRole("log").locator("strong")).toHaveText("۱٬۲۰۰٬۰۰۰ تومان");
  });

  test("sends with Enter and keeps Shift+Enter and Ctrl+Enter on a new line", async ({ page }) => {
    await page.route("**/api/chat/messages", emptyHistory);
    let posted: { messages: { parts: { text: string }[] }[] } | undefined;
    await page.route("**/api/chat", async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 200, headers: STREAM_HEADERS, body: streamResponse("پاسخ آزمون") });
    });
    await page.goto("/?view=chat");
    const textarea = page.getByPlaceholder("مثلاً این ماه چقدر خرج کردم؟");
    await textarea.click();
    await textarea.pressSequentially("خط اول");
    await textarea.press("Shift+Enter");
    await textarea.pressSequentially("خط دوم");
    await expect(textarea).toHaveValue("خط اول\nخط دوم");
    await textarea.press("Control+Enter");
    await textarea.pressSequentially("خط سوم");
    await expect(textarea).toHaveValue("خط اول\nخط دوم\nخط سوم");
    await textarea.press("Enter");
    await expect(textarea).toHaveValue("");
    await expect(page.getByText("پاسخ آزمون")).toBeVisible();
    expect(posted?.messages.at(-1)?.parts[0]?.text).toBe("خط اول\nخط دوم\nخط سوم");
  });

  test("pinned to the bottom while the answer streams in", async ({ page }) => {
    await page.route("**/api/chat/messages", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: Array.from({ length: 25 }, (_, index) => [
            { id: `u${index}`, role: "user", parts: [{ type: "text", text: `سؤال ${index}` }] },
            { id: `a${index}`, role: "assistant", parts: [{ type: "text", text: `پاسخ ${index}`, state: "done" }] },
          ]).flat(),
        }),
      }),
    );
    await page.route("**/api/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ status: 200, headers: STREAM_HEADERS, body: streamResponse("پاسخ آزمون") });
    });
    await page.goto("/?view=chat");
    const log = page.locator('[role="log"]');
    await expect(log.locator("text=پاسخ 24")).toBeVisible();
    expect(await log.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight)).toBe(0);
    await page.getByPlaceholder("مثلاً این ماه چقدر خرج کردم؟").fill("سلام");
    await page.getByPlaceholder("مثلاً این ماه چقدر خرج کردم؟").press("Enter");
    await page.getByText("پاسخ آزمون").waitFor({ state: "attached" });
    await page.waitForTimeout(100);
    expect(await log.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThanOrEqual(1);
  });

  test("shows the dot-elastic animation while waiting for the answer", async ({ page }) => {
    await page.route("**/api/chat/messages", emptyHistory);
    await page.route("**/api/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({ status: 200, headers: STREAM_HEADERS, body: streamResponse("پاسخ آزمون") });
    });
    await page.goto("/?view=chat");
    const textarea = page.getByPlaceholder("مثلاً این ماه چقدر خرج کردم؟");
    await textarea.fill("سلام");
    await textarea.press("Enter");
    await expect(page.locator(".dot-elastic")).toBeVisible();
    await expect(page.locator('[role="log"] .rounded-xl')).toHaveCount(1);
    await expect(page.getByText("پاسخ آزمون")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".dot-elastic")).toHaveCount(0);
  });
});

function longHistory(pairs: number) {
  return {
    messages: Array.from({ length: pairs }, (_, index) => [
      { id: `u${index}`, role: "user", parts: [{ type: "text", text: `سؤال ${index}` }] },
      { id: `a${index}`, role: "assistant", parts: [{ type: "text", text: `پاسخ ${index}`, state: "done" }] },
    ]).flat(),
  };
}

test.describe("chat history layout", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("pins the composer to the screen and keeps the newest messages visible after reload", async ({ page }) => {
    await page.route("**/api/chat/messages", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(longHistory(30)) }),
    );
    await page.goto("/?view=chat");

    await expect(page.locator('[role="log"] .rounded-xl')).toHaveCount(60);

    const composer = page.getByPlaceholder("مثلاً این ماه چقدر خرج کردم؟");
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const box = await composer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

    await expect(page.getByText("پاسخ 29")).toBeInViewport();

    const log = page.locator('[role="log"]');
    const logBox = await log.boundingBox();
    expect(logBox).not.toBeNull();
    expect(logBox!.x).toBe(0);
    expect(logBox!.x + logBox!.width).toBe(1024);
    expect(await log.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator('[role="log"] .rounded-xl')).toHaveCount(60);
    await expect(page.getByText("پاسخ 29")).toBeInViewport();
    const reloadedBox = await composer.boundingBox();
    expect(reloadedBox).not.toBeNull();
    expect(reloadedBox!.y + reloadedBox!.height).toBeLessThanOrEqual(viewport!.height);
  });

  test("eases to the end when the user sends a message while scrolled up", async ({ page }) => {
    await page.route("**/api/chat/messages", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(longHistory(30)) }),
    );
    await page.route("**/api/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ status: 200, headers: STREAM_HEADERS, body: streamResponse("پاسخ آزمون") });
    });
    await page.goto("/?view=chat");
    const log = page.locator('[role="log"]');
    await expect(page.getByText("پاسخ 29")).toBeInViewport();
    await log.evaluate((element) => {
      element.scrollTop = 0;
    });
    const textarea = page.getByPlaceholder("مثلاً این ماه چقدر خرج کردم؟");
    await textarea.fill("سلام");
    await textarea.press("Enter");
    await page.waitForTimeout(80);
    const during = await log.evaluate((element) => ({ top: element.scrollTop, max: element.scrollHeight - element.clientHeight }));
    expect(during.top).toBeGreaterThan(0);
    expect(during.top).toBeLessThan(during.max - 100);
    await page.waitForTimeout(900);
    const after = await log.evaluate((element) => ({ top: element.scrollTop, max: element.scrollHeight - element.clientHeight }));
    expect(after.max - after.top).toBeLessThanOrEqual(1);
  });
});

test.describe("chat page on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("pins the composer above the bottom navigation with a long history", async ({ page }) => {
    await page.route("**/api/chat/messages", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(longHistory(30)) }),
    );
    await page.goto("/?view=chat");
    await expect(page.locator('[role="log"] .rounded-xl')).toHaveCount(60);
    const logBox = await page.locator('[role="log"]').boundingBox();
    expect(logBox).not.toBeNull();
    expect(logBox!.x).toBe(0);
    expect(logBox!.x + logBox!.width).toBe(390);
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const box = await page.getByPlaceholder("مثلاً این ماه چقدر خرج کردم؟").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height - 64);
    await expect(page.getByText("پاسخ 29")).toBeInViewport();
  });

  test("keeps Enter as a newline key instead of sending", async ({ page }) => {
    let chatPosted = false;
    await page.route("**/api/chat/messages", emptyHistory);
    await page.route("**/api/chat", async (route) => {
      chatPosted = true;
      await route.fulfill({ status: 200, headers: STREAM_HEADERS, body: streamResponse("پاسخ آزمون") });
    });
    await page.goto("/?view=chat");
    const textarea = page.getByPlaceholder("مثلاً این ماه چقدر خرج کردم؟");
    await textarea.click();
    await textarea.pressSequentially("خط اول");
    await textarea.press("Enter");
    await textarea.pressSequentially("خط دوم");
    await expect(textarea).toHaveValue("خط اول\nخط دوم");
    expect(chatPosted).toBe(false);
  });
});
