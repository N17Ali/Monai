import { describe, expect, it } from "vitest";
import type { Database } from "../src/infrastructure/db/client";
import { importClipboard } from "../src/features/imports/import.service";

function createDb() {
  const rows: Array<Record<string, unknown>> = [];
  const db = {
    insert() {
      return {
        values: (values: Record<string, unknown>) => {
          rows.push(values);
          return Promise.resolve();
        },
      };
    },
  } as unknown as Database;
  return { db, rows };
}

describe("clipboard import", () => {
  it("stores the extracted amount and the SMS date on the draft", async () => {
    const { db, rows } = createDb();
    const result = await importClipboard(db, { text: "بانک تجارت پرداخت ۴۵۰ ۰۰۰ ریال ۱۴۰۳/۰۵/۰۲-۱۴:۳۰ انجام شد." });
    expect(result).toEqual({ status: "draft_created", id: expect.any(String) });
    expect(rows[0]).toMatchObject({
      amountRial: 450000,
      occurredAt: "2024-07-23T11:00:00.000Z",
      sourceDateText: "۱۴۰۳/۰۵/۰۲-۱۴:۳۰",
      dateWasInferred: false,
    });
  });

  it("stores the extracted balance and account id on the draft", async () => {
    const { db, rows } = createDb();
    await importClipboard(db, { text: "‪300412345678‬\n831,600-\n1405/6/5-14:35\nمانده:889,123,789" });
    expect(rows[0]).toMatchObject({
      amountRial: 831600,
      accountId: "300412345678",
      balanceAfterRial: 889123789,
    });
  });

  it("falls back to import time and marks the date as inferred", async () => {
    const { db, rows } = createDb();
    const before = new Date().getTime();
    await importClipboard(db, { text: "بانک تجارت پرداخت ۴۵۰ ۰۰۰ ریال انجام شد." });
    const after = new Date().getTime();
    expect(rows[0].amountRial).toBe(450000);
    expect(rows[0].dateWasInferred).toBe(true);
    const occurredAt = new Date(rows[0].occurredAt as string).getTime();
    expect(occurredAt).toBeGreaterThanOrEqual(before);
    expect(occurredAt).toBeLessThanOrEqual(after);
  });

  it("blocks sensitive OTP messages before parsing", async () => {
    const { db, rows } = createDb();
    const result = await importClipboard(db, { text: "رمز پویا شما: ۱۲۳۴۵۶" });
    expect(result).toEqual({ status: "sensitive_blocked" });
    expect(rows).toHaveLength(0);
  });
});
