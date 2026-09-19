import { describe, expect, it, vi } from "vitest";
import { formatJalaliDateTime, jalaliToGregorian } from "../shared/parsing/jalali";
import { containsSensitiveCode, normalizeDigits, parseSms } from "../shared/parsing/sms";

describe("bank SMS parsing", () => {
  it("normalizes Persian and Arabic digits", () => {
    expect(normalizeDigits("۱۲٣")).toBe("123");
  });

  it("extracts a Blu expense in Rial", () => {
    expect(parseSms("بلو 418,000 ریال از حساب شما پرید.")).toMatchObject({ amountRial: 418000, kind: "expense", bankId: "blu" });
  });

  it("extracts amounts with space-grouped thousands", () => {
    expect(parseSms("بانک تجارت پرداخت ۴۵۰ ۰۰۰ ریال انجام شد.").amountRial).toBe(450000);
  });

  it("extracts amounts with dot-grouped thousands", () => {
    expect(parseSms("بانک ملت برداشت 500.000 ریال از حساب شما.").amountRial).toBe(500000);
  });

  it("extracts an amount that follows the currency word", () => {
    expect(parseSms("واریز ریال: 250,000 به حساب شما نشست.").amountRial).toBe(250000);
  });

  it("keeps the toman multiplier", () => {
    expect(parseSms("مبلغ 45,000 تومان پرداخت شد.").amountRial).toBe(450000);
  });

  it("extracts the Jalali date and time from the message", () => {
    expect(parseSms("بانک تجارت پرداخت ۴۵۰ ۰۰۰ ریال ۱۴۰۳/۰۵/۰۲-۱۴:۳۰ انجام شد.")).toMatchObject({
      occurredAt: "2024-07-23T11:00:00.000Z",
      sourceDateText: "۱۴۰۳/۰۵/۰۲-۱۴:۳۰",
    });
  });

  it("extracts a date without time at start of day", () => {
    expect(parseSms("تراکنش ۱۴۰۳/۰۵/۰۲ مبلغ ۱۰۰٬۰۰۰ ریال واریز نشست.")).toMatchObject({ occurredAt: "2024-07-22T20:30:00.000Z" });
  });

  it("returns null occurredAt when the message carries no date", () => {
    expect(parseSms("بلو 418,000 ریال از حساب شما پرید.")).toMatchObject({ occurredAt: null, sourceDateText: null });
  });

  it("does not read a date out of card or account numbers", () => {
    expect(parseSms("کارت به کارت از 6037-9911-2345-6789 مبلغ 500,000 ریال واریز نشست.").occurredAt).toBeNull();
  });

  it("blocks OTP messages", () => {
    expect(containsSensitiveCode("رمز پویا ۱۲۳۴۵۶")).toBe(true);
  });
});

describe("user-reported September 2026 messages", () => {
  it("stores the exact Tehran instant for a 1405/6/13 01:52 message", () => {
    expect(parseSms("‪300421666097‬\n786,000-\n1405/6/13-1:52\nمانده:568,833,459 ")).toMatchObject({
      amountRial: 786000,
      kind: "expense",
      accountId: "300421666097",
      occurredAt: "2026-09-03T22:22:00.000Z",
      sourceDateText: "1405/6/13-1:52",
      balanceAfterRial: 568833459,
    });
  });

  it("renders the stored instant as the same Jalali Tehran day the message states", () => {
    expect(formatJalaliDateTime("2026-09-03T22:22:00.000Z")).toBe("1405/06/13 01:52");
    expect(formatJalaliDateTime("2026-09-03T22:36:00.000Z")).toBe("1405/06/13 02:06");
  });

  it("keeps a zero balance as zero instead of dropping it", () => {
    expect(parseSms("‪301470018142595001‬\n3,760,000-\n1405/6/13-2:06\nمانده:0 ")).toMatchObject({
      amountRial: 3760000,
      kind: "expense",
      accountId: "301470018142595001",
      occurredAt: "2026-09-03T22:36:00.000Z",
      balanceAfterRial: 0,
    });
  });

  it("detects the dotted Resalat account number and infers the bank", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T09:00:00Z"));
    try {
      expect(parseSms("10.6190552.1\n+14,000,000 \n05/30_22:01\nمانده: 35,881,234 ")).toMatchObject({
        amountRial: 14000000,
        kind: "income",
        accountId: "10.6190552.1",
        bankId: "resalat",
        occurredAt: "2026-08-21T18:31:00.000Z",
        sourceDateText: "05/30_22:01",
        balanceAfterRial: 35881234,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("detects a dotted Resalat account number in a CRLF-delimited message", () => {
    expect(parseSms("10.6190552.1\r\n+35,000,000 \r\n06/27_14:59\r\nمانده: 111,881,234")).toMatchObject({
      amountRial: 35000000,
      kind: "income",
      accountId: "10.6190552.1",
      bankId: "resalat",
      sourceDateText: "06/27_14:59",
      balanceAfterRial: 111881234,
    });
  });

  it("detects the Resalat bank by name", () => {
    expect(parseSms("بانک رسالت واریز 100,000 ریال به حساب شما نشست.").bankId).toBe("resalat");
  });
});

describe("Mehr, Resalat, and Mellat message formats", () => {
  it("extracts the trailing-sign amount, kind, Jalali date, and balance from a Mehr withdrawal", () => {
    expect(parseSms("‪300412345678‬\n831,600-\n1405/6/5-14:35\nمانده:889,123,789")).toMatchObject({
      amountRial: 831600,
      kind: "expense",
      occurredAt: "2026-08-27T11:05:00.000Z",
      sourceDateText: "1405/6/5-14:35",
      accountId: "300412345678",
      balanceAfterRial: 889123789,
    });
  });

  it("extracts the labeled amount and balance from a Mehr group payment without mistaking the balance for the amount", () => {
    expect(parseSms("پرداخت گروهي\nحساب:‪300412345678‬\nمبلغ:605,537,246\nمانده:974,123,789\nزمان:1405/6/1-10:08")).toMatchObject({
      amountRial: 605537246,
      kind: "income",
      occurredAt: "2026-08-23T06:38:00.000Z",
      sourceDateText: "1405/6/1-10:08",
      accountId: "300412345678",
      balanceAfterRial: 974123789,
    });
  });

  it("extracts the leading-sign amount and infers the year for a Resalat deposit with a month/day date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T09:00:00Z"));
    try {
      expect(parseSms("10.6190552.9\n+14,123,456\n05/30_22:01\nمانده: 35,876,543")).toMatchObject({
        amountRial: 14123456,
        kind: "income",
        occurredAt: "2026-08-21T18:31:00.000Z",
        sourceDateText: "05/30_22:01",
        balanceAfterRial: 35876543,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("extracts the attached-label amount, date, and balance from a Mellat withdrawal", () => {
    expect(parseSms("حساب5352013699\nبرداشت27,123,456\nمانده510,123\n05/05/11-11:30")).toMatchObject({
      amountRial: 27123456,
      kind: "expense",
      occurredAt: "2026-08-02T08:00:00.000Z",
      sourceDateText: "05/05/11-11:30",
      accountId: "5352013699",
      balanceAfterRial: 510123,
    });
  });

  it("extracts the attached-label amount, date, and balance from a Mellat deposit", () => {
    expect(parseSms("حساب5352013699\nواریز27,123,456\nمانده27,751,123\n05/04/07-07:00")).toMatchObject({
      amountRial: 27123456,
      kind: "income",
      occurredAt: "2026-06-28T03:30:00.000Z",
      sourceDateText: "05/04/07-07:00",
      accountId: "5352013699",
      balanceAfterRial: 27751123,
    });
  });

  it("keys a Mellat transfer by the source account and captures its missing balance as null", () => {
    expect(parseSms("سپرده5352053769\nبه حساب5352013699\nمبلغ348,123\n05/06/01")).toMatchObject({
      amountRial: 348123,
      kind: "transfer_out",
      occurredAt: "2026-08-22T20:30:00.000Z",
      sourceDateText: "05/06/01",
      accountId: "5352053769",
      balanceAfterRial: null,
    });
  });
});

describe("balance and account extraction", () => {
  it("keeps the toman multiplier for balances", () => {
    expect(parseSms("موجودی شما 45,000 تومان باقی است.").balanceAfterRial).toBe(450000);
  });

  it("extracts a currency-labeled balance in Rial with a decorated label", () => {
    expect(parseSms("موجودی جدید شما: 12,345,678 ريال").balanceAfterRial).toBe(12345678);
  });

  it("extracts a Persian-digit balance", () => {
    expect(parseSms("برداشت 100,000 ریال\nمانده: ۸۸۹,۱۲۳,۷۸۹").balanceAfterRial).toBe(889123789);
  });

  it("prefers the transaction amount over a leading currency-labeled balance", () => {
    expect(parseSms("موجودی: 889,123,789 ریال برداشت 831,600 ریال انجام شد.")).toMatchObject({
      amountRial: 831600,
      kind: "expense",
      balanceAfterRial: 889123789,
    });
  });

  it("returns a null balance when the message carries none", () => {
    expect(parseSms("بلو 418,000 ریال از حساب شما پرید.").balanceAfterRial).toBeNull();
  });

  it("does not read an account out of a card number or a labeled account without digits", () => {
    expect(parseSms("کارت به کارت از 6037-9911-2345-6789 مبلغ 500,000 ریال واریز نشست.").accountId).toBeNull();
    expect(parseSms("بلو 418,000 ریال از حساب شما پرید.").accountId).toBeNull();
  });
});

describe("jalali to gregorian conversion", () => {
  it("matches the ICU Persian calendar for every day from 2015 to 2030", () => {
    const formatter = new Intl.DateTimeFormat("en-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
    for (let utc = Date.UTC(2015, 0, 1); utc <= Date.UTC(2030, 11, 31); utc += 86_400_000) {
      const date = new Date(utc);
      const parts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
      const { gy, gm, gd } = jalaliToGregorian(Number(parts.year), Number(parts.month), Number(parts.day));
      expect(`${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`, date.toISOString().slice(0, 10)).toBe(date.toISOString().slice(0, 10));
      expect(Date.UTC(gy, gm - 1, gd)).toBe(utc);
    }
  });
});
