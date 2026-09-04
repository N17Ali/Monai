import { useEffect, useId, useRef, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Dialog({ children, className, description, onOpenChange, open, title }: PropsWithChildren<{ className?: string; description?: string; onOpenChange: (open: boolean) => void; open: boolean; title: string }>) {
  const titleId = useId();
  const descriptionId = useId();
  const contentRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const content = contentRef.current;
    content?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onOpenChange(false);
      if (event.key !== "Tab" || !content) return;
      const focusable = Array.from(content.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return event.preventDefault();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 bg-black/40" onMouseDown={(event) => event.target === event.currentTarget && onOpenChange(false)}>
      <section aria-describedby={description ? descriptionId : undefined} aria-labelledby={titleId} aria-modal="true" className={cn("fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-auto rounded-t-xl bg-surface p-5 outline-none lg:inset-auto lg:start-[17rem] lg:bottom-7 lg:w-[480px] lg:rounded-xl", className)} dir="rtl" ref={contentRef} role="dialog" tabIndex={-1}>
        <h2 className="text-lg font-bold" id={titleId}>{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground" id={descriptionId}>{description}</p>}
        {children}
        <Button className="mt-3 w-full" onClick={() => onOpenChange(false)} type="button" variant="ghost">بستن</Button>
      </section>
    </div>,
    document.body,
  );
}
