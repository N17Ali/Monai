import { ClipboardIcon, ReceiptIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

// The capture flow's two entry choices and the privacy note. Shared by the
// mobile Drawer and the desktop Dialog so the icons, labels, and copy live
// once; the containers stay presentation adapters.
export function CaptureChoices({ onChoose, className }: { onChoose: (choice: "clipboard" | "manual") => void; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)}>
      <button aria-label="خواندن پیام بانکی" className="choice-card choice-card-primary flex min-h-16 items-center gap-3 rounded-lg border border-primary bg-primary-soft p-3 text-start transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]" onClick={() => onChoose("clipboard")} type="button">
        <HugeiconsIcon className="text-primary" icon={ClipboardIcon} size={24} />
        <span>
          <strong className="block text-sm">خواندن پیام بانکی</strong>
          <small className="mt-1 block text-muted-foreground">پیام کپی‌شده را سریع وارد کن</small>
        </span>
      </button>
      <button aria-label="ثبت" className="choice-card flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface p-3 text-start transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]" onClick={() => onChoose("manual")} type="button">
        <HugeiconsIcon className="text-primary" icon={ReceiptIcon} size={24} />
        <span>
          <strong className="block text-sm">ثبت</strong>
          <small className="mt-1 block text-muted-foreground">اگر پیام بانکی در دسترس نیست</small>
        </span>
      </button>
      <p className="rounded-lg bg-surface-muted p-3 text-xs leading-6 text-muted-foreground">پیام فقط برای استخراج اطلاعات تراکنش بررسی می‌شود.<br />پیام‌های حاوی رمز ذخیره نمی‌شوند.</p>
    </div>
  );
}
