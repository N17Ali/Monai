import type { TransactionKind } from "../contracts/transaction";
import { jalaliToGregorian, jalaliToIso } from "./jalali";

const persian = "۰۱۲۳۴۵۶۷۸۹";
const arabic = "٠١٢٣٤٥٦٧٨٩";
const currency = "(ریال|ريال|تومان)";
const numericAmount = "([0-9][0-9\\s,.٬]*)";
const labeledAmount = "([0-9](?:[0-9,.٬]| (?=[0-9]))*)";
const amountVerbs = "مبلغ|برداشت|واریز|نشست|پرید|پرداخت";
const bidiMark = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

export function normalizeDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = persian.indexOf(digit);
    return String(persianIndex >= 0 ? persianIndex : arabic.indexOf(digit));
  });
}

function normalizeForMatch(text: string) {
  let value = "";
  const origin: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    const persianIndex = persian.indexOf(ch);
    const arabicIndex = arabic.indexOf(ch);
    if (persianIndex >= 0 || arabicIndex >= 0) value += String(persianIndex >= 0 ? persianIndex : arabicIndex);
    else if (!bidiMark.test(ch)) value += ch;
    else continue;
    origin.push(index);
  }
  return { value, origin };
}

function parseAmount(raw: string) {
  return Number(raw.replace(/[\s,.٬]/g, "")) || 0;
}

type BalanceMatch = { balanceRial: number; index: number; length: number };

function readBalance(normalized: string): BalanceMatch | null {
  const match = normalized.match(/(?:موجود[یي]|مانده)[^0-9\n]{0,16}?([0-9][0-9,.٬ ]*)(?:\s*(ریال|ريال|تومان))?/);
  if (!match || match[1] == null || match.index == null) return null;
  const balanceRial = parseAmount(match[1]);
  return { balanceRial: match[2] === "تومان" ? balanceRial * 10 : balanceRial, index: match.index, length: match[0].length };
}

function maskBalance(normalized: string, balance: BalanceMatch | null) {
  if (!balance) return normalized;
  return normalized.slice(0, balance.index) + " ".repeat(balance.length) + normalized.slice(balance.index + balance.length);
}

function readAccountId(normalized: string): string | null {
  const transferSource = normalized.match(/سپرده\s*[:：]?\s*([0-9]{6,})\s*به\s*حساب/);
  if (transferSource?.[1]) return transferSource[1];
  const labeled = normalized.match(/حساب\s*[:：]?\s*([0-9]{6,})/);
  if (labeled?.[1]) return labeled[1];
  const bareLine = normalized.match(/(?:^|[\r\n])([0-9]{10,19})(?=[\r\n]|$)/);
  if (bareLine?.[1]) return bareLine[1];
  const dottedLine = normalized.match(/(?:^|[\r\n])([0-9]{1,6}(?:\.[0-9]{1,9}){1,4})(?=[\r\n]|$)/);
  const dotted = dottedLine?.[1];
  if (dotted && dotted.replace(/\./g, "").length >= 10) return dotted;
  return null;
}

function readAmount(normalized: string): { amountRial: number; signKind: TransactionKind | null } {
  const beforeCurrency = normalized.match(new RegExp(`${numericAmount}\\s*${currency}`, "i"));
  const afterCurrency = normalized.match(new RegExp(`${currency}\\s*[:：]?\\s*${numericAmount}`, "i"));
  const raw = beforeCurrency?.[1] ?? afterCurrency?.[2];
  if (raw != null) {
    const unit = beforeCurrency?.[2] ?? afterCurrency?.[1] ?? "";
    const amount = parseAmount(raw);
    return { amountRial: unit === "تومان" ? amount * 10 : amount, signKind: null };
  }
  const labeled = normalized.match(new RegExp(`(?:${amountVerbs})\\s*[:：]?\\s*${labeledAmount}`));
  if (labeled) return { amountRial: parseAmount(labeled[1] ?? ""), signKind: null };
  for (const line of normalized.split("\n")) {
    const signed = line.trim().match(/^([+-]?)([0-9][0-9,.٬]*(?: [0-9][0-9,.٬]*)*)([+-]?)$/);
    if (signed && (signed[1] || signed[3])) {
      return { amountRial: parseAmount(signed[2] ?? ""), signKind: (signed[1] || signed[3]) === "+" ? "income" : "expense" };
    }
  }
  return { amountRial: 0, signKind: null };
}

function currentJalaliYear(now: Date) {
  const candidate = now.getUTCFullYear() - 621;
  const newYear = jalaliToGregorian(candidate, 1, 1);
  return now.getTime() < Date.UTC(newYear.gy, newYear.gm - 1, newYear.gd) ? candidate - 1 : candidate;
}

function sliceSource(text: string, origin: number[], start: number, length: number) {
  return text.slice(origin[start], origin[start + length - 1] + 1);
}

function readDate(text: string, normalized: string, origin: number[]) {
  const fullYear = normalized.match(/(1[34]\d{2})[/.](\d{1,2})[/.](\d{1,2})(?:[-_\s](\d{1,2}):(\d{2}))?/);
  if (fullYear && fullYear.index != null) {
    return {
      occurredAt: jalaliToIso(Number(fullYear[1]), Number(fullYear[2]), Number(fullYear[3]), Number(fullYear[4] ?? 0), Number(fullYear[5] ?? 0)),
      sourceDateText: sliceSource(text, origin, fullYear.index, fullYear[0].length),
    };
  }
  const shortYear = normalized.match(/(\d{1,2})\/(\d{1,2})\/(\d{1,2})(?:[-_ ](\d{1,2}):(\d{2}))?/);
  if (shortYear && shortYear.index != null) {
    const month = Number(shortYear[2]);
    const day = Number(shortYear[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const twoDigit = Number(shortYear[1]);
      const year = twoDigit >= 70 ? 1300 + twoDigit : 1400 + twoDigit;
      return {
        occurredAt: jalaliToIso(year, month, day, Number(shortYear[4] ?? 0), Number(shortYear[5] ?? 0)),
        sourceDateText: sliceSource(text, origin, shortYear.index, shortYear[0].length),
      };
    }
  }
  const monthDay = normalized.match(/(\d{1,2})\/(\d{1,2})(?!\/\d)(?:[-_ ](\d{1,2}):(\d{2}))?/);
  if (monthDay && monthDay.index != null) {
    const month = Number(monthDay[1]);
    const day = Number(monthDay[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const now = new Date();
      const hour = Number(monthDay[3] ?? 0);
      const minute = Number(monthDay[4] ?? 0);
      let year = currentJalaliYear(now);
      let occurredAt = jalaliToIso(year, month, day, hour, minute);
      if (Date.parse(occurredAt) > now.getTime() + 2 * 86_400_000) {
        year -= 1;
        occurredAt = jalaliToIso(year, month, day, hour, minute);
      }
      return { occurredAt, sourceDateText: sliceSource(text, origin, monthDay.index, monthDay[0].length) };
    }
  }
  return { occurredAt: null, sourceDateText: null };
}

export function parseSms(text: string) {
  const { value: normalized, origin } = normalizeForMatch(text);
  const balance = readBalance(normalized);
  const { amountRial, signKind } = readAmount(maskBalance(normalized, balance));
  let kind: TransactionKind = "unknown";
  if (/(واریز|نشست|پرداخت گروه[یي])/.test(normalized)) kind = "income";
  else if (/(برداشت|پرداخت|پرید)/.test(normalized)) kind = "expense";
  else if (/(?:سپرده|حساب)\s*\d+\s*به\s*حساب/.test(normalized)) kind = "transfer_out";
  else if (signKind) kind = signKind;
  const bankId = /بلو/.test(normalized) ? "blu" : /تجارت/.test(normalized) ? "tejarat" : /ملت/.test(normalized) ? "mellat" : /رسالت/.test(normalized) ? "resalat" : null;
  const accountId = readAccountId(normalized);
  const inferredBankId = bankId ?? (accountId != null && accountId.includes(".") ? "resalat" : null);
  return { amountRial, kind, bankId: inferredBankId, accountId, balanceAfterRial: balance?.balanceRial ?? null, ...readDate(text, normalized, origin) };
}

export function containsSensitiveCode(text: string) {
  return /(رمز\s*(پویا|یکبار|یک\s*بار)?|کد\s*(ورود|تایید|تأیید)|\bOTP\b|verification\s*code)/i.test(text);
}
