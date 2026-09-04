import { ClipboardIcon, ReceiptIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Dialog } from "@/components/ui/dialog";

export function CaptureDialog({ open, onOpenChange, onChoose }: { open: boolean; onOpenChange: (value: boolean) => void; onChoose: (choice: "clipboard" | "manual") => void }) {
  return <Dialog className="lg:w-[440px]" description="روش ورود اطلاعات را انتخاب کنید." onOpenChange={onOpenChange} open={open} title="ثبت تراکنش"><div className="mt-5 grid gap-3"><button className="flex min-h-16 items-center gap-3 rounded-lg border border-border p-3 text-start hover:bg-surface-muted" onClick={() => onChoose("clipboard")}><HugeiconsIcon className="text-primary" icon={ClipboardIcon} size={24} /><span><strong className="block text-sm">خواندن از کلیپ‌بورد</strong><small className="mt-1 block text-muted-foreground">پیام بانکی کپی‌شده را وارد کن</small></span></button><button className="flex min-h-16 items-center gap-3 rounded-lg border border-border p-3 text-start hover:bg-surface-muted" onClick={() => onChoose("manual")}><HugeiconsIcon className="text-primary" icon={ReceiptIcon} size={24} /><span><strong className="block text-sm">ثبت دستی تراکنش</strong><small className="mt-1 block text-muted-foreground">اطلاعات را خودت وارد کن</small></span></button></div></Dialog>;
}
