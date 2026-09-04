import { parseAsStringLiteral } from "nuqs";

export const views = ["home", "transactions", "enrichment", "chat", "settings"] as const;
export type View = (typeof views)[number];
export const viewParser = parseAsStringLiteral(views).withDefault("home");

export const viewLabels: Record<View, string> = {
  home: "خانه",
  transactions: "تراکنش‌ها",
  enrichment: "تکمیل اطلاعات",
  chat: "گفت‌وگو",
  settings: "تنظیمات",
};
