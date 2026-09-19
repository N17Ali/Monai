function div(a: number, b: number) {
  return Math.trunc(a / b);
}

function mod(a: number, b: number) {
  return a - Math.trunc(a / b) * b;
}

function jalCal(jy: number) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;
  if (jy < jp || jy >= breaks[breaks.length - 1]) throw new Error("Invalid Jalali year");
  for (let i = 1; i < breaks.length; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function gregorianToJdn(gy: number, gm: number, gd: number) {
  let value = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  value = value - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return value;
}

function jdnToGregorian(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function jalaliToJdn(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return gregorianToJdn(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

export type JalaliDate = { jy: number; jm: number; jd: number };

const tehranOffsetMs = 3.5 * 60 * 60 * 1000;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function jalaliToGregorian(jy: number, jm: number, jd: number) {
  return jdnToGregorian(jalaliToJdn(jy, jm, jd));
}

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const jdn = gregorianToJdn(gy, gm, gd);
  let jy = gy - 621;
  if (jdn < jalaliToJdn(jy, 1, 1)) jy -= 1;
  else if (jdn >= jalaliToJdn(jy + 1, 1, 1)) jy += 1;
  let dayOfYear = jdn - jalaliToJdn(jy, 1, 1);
  if (dayOfYear < 186) return { jy, jm: 1 + div(dayOfYear, 31), jd: mod(dayOfYear, 31) + 1 };
  dayOfYear -= 186;
  return { jy, jm: 7 + div(dayOfYear, 30), jd: mod(dayOfYear, 30) + 1 };
}

export function jalaliMonthLength(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalaliToJdn(jy, 12, 30) < jalaliToJdn(jy + 1, 1, 1) ? 30 : 29;
}

export type JalaliDateTime = JalaliDate & { hour: number; minute: number };

export function nowJalaliTehran(now = new Date()): JalaliDateTime {
  const tehran = new Date(now.getTime() + tehranOffsetMs);
  const { jy, jm, jd } = gregorianToJalali(tehran.getUTCFullYear(), tehran.getUTCMonth() + 1, tehran.getUTCDate());
  return { jy, jm, jd, hour: tehran.getUTCHours(), minute: tehran.getUTCMinutes() };
}

export function formatJalaliDateTime(iso: string) {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const tehran = new Date(instant.getTime() + tehranOffsetMs);
  const { jy, jm, jd } = gregorianToJalali(tehran.getUTCFullYear(), tehran.getUTCMonth() + 1, tehran.getUTCDate());
  return `${jy}/${pad(jm)}/${pad(jd)} ${pad(tehran.getUTCHours())}:${pad(tehran.getUTCMinutes())}`;
}

export function jalaliToIso(jy: number, jm: number, jd: number, hour = 0, minute = 0) {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return new Date(Date.UTC(gy, gm - 1, gd, hour, minute) - tehranOffsetMs).toISOString();
}

export const JALALI_MONTH_NAMES = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"] as const;

export function jalaliMonthName(jm: number) {
  return JALALI_MONTH_NAMES[jm - 1];
}

const JALALI_WEEKDAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

function jalaliDayShift(date: JalaliDate, days: number): JalaliDate {
  const { gy, gm, gd } = jalaliToGregorian(date.jy, date.jm, date.jd);
  const shifted = new Date(Date.UTC(gy, gm - 1, gd) + days * 86400000);
  return gregorianToJalali(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

// The Jalali week runs Saturday to Friday. A date's weekday index is 0 for
// شنبه … 6 for جمعه, so shifting back by that many days lands on the week's
// first day.
function jalaliWeekdayIndex(date: JalaliDate) {
  const { gy, gm, gd } = jalaliToGregorian(date.jy, date.jm, date.jd);
  return (new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay() + 1) % 7;
}

export function jalaliWeekStart(jy: number, jm: number, jd: number): JalaliDate {
  const date = { jy, jm, jd };
  return jalaliDayShift(date, -jalaliWeekdayIndex(date));
}

export function jalaliWeekEnd(jy: number, jm: number, jd: number): JalaliDate {
  return jalaliDayShift(jalaliWeekStart(jy, jm, jd), 6);
}

export function jalaliWeekdayName(jy: number, jm: number, jd: number) {
  return JALALI_WEEKDAY_NAMES[jalaliWeekdayIndex({ jy, jm, jd })];
}

export function formatJalaliDay(date: JalaliDate) {
  return `${date.jy}/${pad(date.jm)}/${pad(date.jd)}`;
}

export function parseJalaliDay(text: string): JalaliDate | null {
  const match = text.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const [jy, jm, jd] = match.slice(1).map(Number);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  return { jy, jm, jd };
}
