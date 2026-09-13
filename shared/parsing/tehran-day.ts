import { gregorianToJalali } from "./jalali";

const tehranOffsetMs = 3.5 * 60 * 60 * 1000;

export function tehranJalaliDay(date: string) {
  const tehran = new Date(new Date(date).getTime() + tehranOffsetMs);
  return gregorianToJalali(tehran.getUTCFullYear(), tehran.getUTCMonth() + 1, tehran.getUTCDate());
}
