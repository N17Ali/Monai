import { describe, expect, it } from "vitest";
import { importClipboard } from "../src/features/imports/import.service";
import { createMemoryStorage } from "../src/infrastructure/storage.memory";

function storage() {
  return createMemoryStorage("test-user");
}

describe("clipboard import", () => {
  it("stores the extracted amount and the SMS date on the draft", async () => {
    const store = storage();
    const result = await importClipboard(store.transactions, { text: "بانک تجارت پرداخت ۴۵۰ ۰۰۰ ریال ۱۴۰۳/۰۵/۰۲-۱۴:۳۰ انجام شد." });
    expect(result).toEqual({ status: "draft_created", id: expect.any(String) });
    const [draft] = await store.transactions.listDrafts();
    expect(draft).toMatchObject({
      amountRial: 450000,
      occurredAt: "2024-07-23T11:00:00.000Z",
      sourceDateText: "۱۴۰۳/۰۵/۰۲-۱۴:۳۰",
      dateWasInferred: false,
    });
  });

  it("stores the extracted balance and account id on the draft", async () => {
    const store = storage();
    await importClipboard(store.transactions, { text: "‪300412345678‬\n831,600-\n1405/6/5-14:35\nمانده:889,123,789" });
    const [draft] = await store.transactions.listDrafts();
    expect(draft).toMatchObject({
      amountRial: 831600,
      accountId: "300412345678",
      balanceAfterRial: 889123789,
    });
  });

  it("falls back to import time and marks the date as inferred", async () => {
    const store = storage();
    const before = new Date().getTime();
    await importClipboard(store.transactions, { text: "بانک تجارت پرداخت ۴۵۰ ۰۰۰ ریال انجام شد." });
    const after = new Date().getTime();
    const [draft] = await store.transactions.listDrafts();
    expect(draft?.amountRial).toBe(450000);
    expect(draft?.dateWasInferred).toBe(true);
    const occurredAt = new Date(draft?.occurredAt ?? 0).getTime();
    expect(occurredAt).toBeGreaterThanOrEqual(before);
    expect(occurredAt).toBeLessThanOrEqual(after);
  });

  it("detects a duplicate through the storage port", async () => {
    const store = storage();
    const text = "بانک تجارت پرداخت ۴۵۰ ۰۰۰ ریال ۱۴۰۳/۰۵/۰۲-۱۴:۳۰ انجام شد.";
    await importClipboard(store.transactions, { text });
    const result = await importClipboard(store.transactions, { text });
    expect(result).toEqual({ status: "duplicate" });
    expect(await store.transactions.listDrafts()).toHaveLength(1);
  });

  it("blocks sensitive OTP messages before parsing", async () => {
    const store = storage();
    const result = await importClipboard(store.transactions, { text: "رمز پویا شما: ۱۲۳۴۵۶" });
    expect(result).toEqual({ status: "sensitive_blocked" });
    expect(await store.transactions.listDrafts()).toHaveLength(0);
  });
});
