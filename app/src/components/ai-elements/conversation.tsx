import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export function Conversation({ ref, className, ...props }: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) {
  return <div ref={ref} role="log" className={cn("min-h-0 flex-1 overflow-y-auto", className)} {...props} />;
}

export function ConversationContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto flex w-full max-w-3xl flex-col gap-4 p-4", className)} {...props} />;
}

export function ConversationEmptyState({ title, description }: { title: string; description: string }) {
  return <div className="grid min-h-72 place-content-center text-center"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>;
}
