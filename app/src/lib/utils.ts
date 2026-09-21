import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { rialToToman } from "@shared/money";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatToman(amountRial: number) {
  const amount = Math.round(rialToToman(amountRial));
  return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
}

export function formatJalali(date: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(new Date(date));
}

export function toPersianDigits(value: string) {
  return value.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}
