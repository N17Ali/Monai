import { expect, test, type Locator } from "@playwright/test";

const transactionsUrl = /\/api\/transactions(\?.*)?$/;

function verifiedFixture(overrides: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    source: "clipboard",
    status: "verified",
    kind: "expense",
    amountRial: 500000,
    occurredAt: "2026-08-25T20:00:00.000Z",
    sourceDateText: null,
    dateWasInferred: false,
    bankId: "tejarat",
    accountId: "1234567890",
    balanceAfterRial: 200000000,
    bankDescription: null,
    userNote: null,
    categoryId: null,
    originalMessage: null,
    ...overrides,
  };
}

async function routeChartData(page: import("@playwright/test").Page) {
  await page.route(transactionsUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        nextCursor: null,
        transactions: [
          verifiedFixture({ occurredAt: "2026-08-29T20:00:00.000Z", balanceAfterRial: 280000000 }),
          verifiedFixture({ occurredAt: "2026-08-27T20:00:00.000Z", balanceAfterRial: 350000000, accountId: "9876543210" }),
          verifiedFixture({ occurredAt: "2026-08-25T20:00:00.000Z", balanceAfterRial: 200000000 }),
        ],
      }),
    }),
  );
  await page.route("**/api/enrichment", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ drafts: [], count: 0 }) }),
  );
}

async function yAxisTicks(page: import("@playwright/test").Page) {
  const chart = page.locator(".balance-flow-chart");
  await expect(chart).toBeVisible();
  await expect(chart.getByRole("heading", { name: "روند مانده حساب‌ها" })).toBeVisible();
  const ticks = chart.locator(".recharts-cartesian-axis-tick-value").filter({ hasText: /^(?![\s\S]*شهریور)[\s\S]*$/ });
  await expect(ticks.first()).toBeVisible();
  return ticks;
}

test.describe("home balance chart", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps Y-axis labels visible inside the chart on desktop", async ({ page }) => {
    await routeChartData(page);
    await page.goto("/");
    const ticks = await yAxisTicks(page);

    const surface = page.locator(".recharts-surface");
    const surfaceBox = (await surface.boundingBox())!;
    expect(surfaceBox).not.toBeNull();

    const count = await ticks.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < count; index += 1) {
      const box = (await ticks.nth(index).boundingBox())!;
      expect(box).not.toBeNull();
      expect(box.x, `tick ${index} clipped off the left edge`).toBeGreaterThanOrEqual(surfaceBox.x - 0.5);
      expect(box.x + box.width, `tick ${index} overflows the right edge`).toBeLessThanOrEqual(surfaceBox.x + surfaceBox.width + 0.5);
      const text = (await ticks.nth(index).textContent()) ?? "";
      expect(text, "axis ticks must use the compact unit format").not.toContain("تومان");
    }
  });

  test("shows the day's closing balance and daily change in the hover tooltip", async ({ page }) => {
    await routeChartData(page);
    await page.goto("/");
    await yAxisTicks(page);

    const surface = page.locator(".recharts-surface");
    const surfaceBox = (await surface.boundingBox())!;
    // Fixture: day 1405/06/03 closes at 20M, 1405/06/05 adds a second account
    // at 350M (total 55M), 1405/06/07 moves account A to 280M (total 63M,
    // daily change +8M). Hover near the last point.
    await page.mouse.move(surfaceBox.x + surfaceBox.width * 0.92, surfaceBox.y + surfaceBox.height / 2);
    const tooltip = page.locator(".recharts-tooltip-wrapper");
    await expect(tooltip).toContainText("1405/06/07");
    await expect(tooltip).toContainText("تغییر روزانه: ۸ میلیون تومان");
    await expect(tooltip).toContainText("مانده کل: ۶۳٬۰۰۰٬۰۰۰ تومان");

    // And near the first data point: opening day has no daily change.
    await page.mouse.move(surfaceBox.x + surfaceBox.width * 0.1, surfaceBox.y + surfaceBox.height / 2);
    await expect(tooltip).toContainText("1405/06/03");
    await expect(tooltip).toContainText("تغییر روزانه: ۰ تومان");
    await expect(tooltip).toContainText("مانده کل: ۲۰٬۰۰۰٬۰۰۰ تومان");
  });

  test("shows the current cumulative balance in full, not a rounded compact figure", async ({ page }) => {
    await routeChartData(page);
    await page.goto("/");
    await yAxisTicks(page);

    const summary = page.locator(".balance-flow-chart").getByText(/مانده کل:/);
    await expect(summary).toContainText("مانده کل: ۶۳٬۰۰۰٬۰۰۰ تومان");
    await expect(summary).not.toContainText("میلیون");
  });
});

test.describe("home balance chart on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the Y axis compact so the plot keeps the width", async ({ page }) => {
    await routeChartData(page);
    await page.goto("/");
    const ticks = await yAxisTicks(page);

    const surface = page.locator(".recharts-surface");
    const surfaceBox = (await surface.boundingBox())!;
    expect(surfaceBox).not.toBeNull();

    const count = await ticks.count();
    expect(count).toBeGreaterThanOrEqual(2);
    let rightmost = 0;
    for (let index = 0; index < count; index += 1) {
      const box = (await ticks.nth(index).boundingBox())!;
      expect(box).not.toBeNull();
      expect(box.x, `tick ${index} clipped off the left edge`).toBeGreaterThanOrEqual(surfaceBox.x - 0.5);
      rightmost = Math.max(rightmost, box.x + box.width);
    }
    expect(rightmost - surfaceBox.x, "Y-axis labels must stay compact on mobile").toBeLessThanOrEqual(48);
  });
});
