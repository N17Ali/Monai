import { describe, expect, it } from "vitest";
import { gregorianToJalali, jalaliToGregorian, jalaliToIso, nowJalaliTehran } from "../shared/parsing/jalali";

describe("gregorian to jalali conversion", () => {
  it("maps 2026-09-04 to 1405/6/13", () => {
    expect(gregorianToJalali(2026, 9, 4)).toEqual({ jy: 1405, jm: 6, jd: 13 });
  });

  it("round-trips against the ICU Persian calendar for every day from 2015 to 2030", () => {
    const formatter = new Intl.DateTimeFormat("en-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
    for (let utc = Date.UTC(2015, 0, 1); utc <= Date.UTC(2030, 11, 31); utc += 86_400_000) {
      const date = new Date(utc);
      const parts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
      const { jy, jm, jd } = gregorianToJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
      expect([jy, jm, jd]).toEqual([Number(parts.year), Number(parts.month), Number(parts.day)]);
      expect(jalaliToGregorian(jy, jm, jd)).toEqual({ gy: date.getUTCFullYear(), gm: date.getUTCMonth() + 1, gd: date.getUTCDate() });
    }
  });
});

describe("nowJalaliTehran", () => {
  it("reads the Tehran wall clock from a UTC instant", () => {
    expect(nowJalaliTehran(new Date("2026-09-03T22:22:00.000Z"))).toEqual({ jy: 1405, jm: 6, jd: 13, hour: 1, minute: 52 });
  });

  it("rolls to the next Jalali day after Tehran midnight", () => {
    expect(nowJalaliTehran(new Date("2026-09-03T20:29:00.000Z"))).toEqual({ jy: 1405, jm: 6, jd: 12, hour: 23, minute: 59 });
    expect(nowJalaliTehran(new Date("2026-09-03T20:30:00.000Z"))).toEqual({ jy: 1405, jm: 6, jd: 13, hour: 0, minute: 0 });
  });

  it("seeds a picker default that converts back to the same Tehran instant", () => {
    const instant = "2026-09-03T22:22:00.000Z";
    const now = nowJalaliTehran(new Date(instant));
    expect(jalaliToIso(now.jy, now.jm, now.jd, now.hour, now.minute)).toBe(instant);
  });
});
