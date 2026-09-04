import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Message({ from, className, ...props }: HTMLAttributes<HTMLDivElement> & { from: "user" | "assistant" | "system" }) {
  return <div className={cn("flex", from === "user" ? "justify-start" : "justify-end", className)} {...props} />;
}

export function MessageContent({ from, className, ...props }: HTMLAttributes<HTMLDivElement> & { from: "user" | "assistant" | "system" }) {
  return <div className={cn("max-w-[88%] rounded-xl px-4 py-3 text-sm leading-7", from === "user" ? "bg-primary text-white" : "bg-surface-muted text-foreground", className)} {...props} />;
}

export function MessageResponse({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("whitespace-pre-wrap", className)} {...props} />;
}
