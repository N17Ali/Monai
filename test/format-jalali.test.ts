import { afterEach, describe, expect, it } from "vitest";
import { formatJalali } from "../app/src/lib/utils";

describe("formatJalali", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("renders the Tehran-local Jalali day even when the device runs in UTC", () => {
    process.env.TZ = "UTC";
    expect(formatJalali("2026-09-03T22:22:00.000Z")).toMatch(/۱۳\s+شهریور/);
  });
});
