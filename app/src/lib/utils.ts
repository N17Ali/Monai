import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatToman(amountRial: number) {
  const amount = Math.round(amountRial / 10);
  return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
}

export function formatJalali(date: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(new Date(date));
}
