import { rialToToman } from "@shared/money";

export function formatCompactToman(amountRial: number) {
  const amount = rialToToman(amountRial);
  const absolute = Math.abs(amount);
  const unit = absolute >= 1_000_000_000 ? [1_000_000_000, "میلیارد"] : absolute >= 1_000_000 ? [1_000_000, "میلیون"] : absolute >= 1_000 ? [1_000, "هزار"] : [1, ""];
  const value = amount / Number(unit[0]);
  const formatted = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(Math.abs(value));
  return `${amount < 0 ? "−" : ""}${formatted}${unit[1] ? ` ${unit[1]}` : ""} تومان`;
}

export function formatExactToman(amountRial: number) {
  const amount = rialToToman(amountRial);
  return `${amount < 0 ? "−" : ""}${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(Math.abs(amount))} تومان`;
}

export function formatAxisToman(amountRial: number) {
  const amount = rialToToman(amountRial);
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  const formatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
  if (absolute >= 1_000_000_000) return `${sign}${formatter.format(absolute / 1_000_000_000)} میلیارد`;
  if (absolute >= 1_000_000) return `${sign}${formatter.format(absolute / 1_000_000)} میلیون`;
  if (absolute >= 1_000) return `${sign}${formatter.format(absolute / 1_000)} هزار`;
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(amount);
}
