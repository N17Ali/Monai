import type { FormHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PromptInput({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form className={cn("flex items-end gap-2 rounded-xl border border-border bg-surface p-2", className)} {...props} />;
}

export function PromptInputTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Textarea className={cn("min-h-12 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0", className)} {...props} />;
}

export function PromptInputSubmit({ disabled, children = "بپرس" }: { disabled?: boolean; children?: React.ReactNode }) {
  return <Button className="min-w-28" disabled={disabled} type="submit">{children}</Button>;
}
