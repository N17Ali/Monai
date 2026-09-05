import { ClipboardIcon, ReceiptIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dispatch, SetStateAction } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { CaptureDialog } from "./capture-dialog";
import { ClipboardImportDialog, ClipboardImportForm } from "./clipboard-import-dialog";
import { ManualForm, ManualTransactionDialog } from "@/features/transactions/manual-transaction-dialog";

export type CaptureStep = "choose" | "clipboard" | "manual";

function ChoiceButtons({ onChoose }: { onChoose: (choice: "clipboard" | "manual") => void }) {
  return <div className="grid gap-3 p-4"><button className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface p-3 text-start transition hover:bg-surface-muted" onClick={() => onChoose("clipboard")} type="button"><HugeiconsIcon className="text-primary" icon={ClipboardIcon} size={24} /><span><strong className="block text-sm">خواندن از کلیپ‌بورد</strong><small className="mt-1 block text-muted-foreground">پیام بانکی کپی‌شده را وارد کن</small></span></button><button className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface p-3 text-start transition hover:bg-surface-muted" onClick={() => onChoose("manual")} type="button"><HugeiconsIcon className="text-primary" icon={ReceiptIcon} size={24} /><span><strong className="block text-sm">ثبت دستی تراکنش</strong><small className="mt-1 block text-muted-foreground">اطلاعات را خودت وارد کن</small></span></button></div>;
}

function MobileCaptureSheet({ capture, onCaptureChange, onCreated }: { capture: CaptureStep | null; onCaptureChange: Dispatch<SetStateAction<CaptureStep | null>>; onCreated: () => void }) {
  const closeAll = () => onCaptureChange(null);
  const closeNested = () => onCaptureChange("choose");
  return <Drawer onOpenChange={(open) => !open && closeAll()} open={capture != null} showSwipeHandle><DrawerContent><DrawerHeader><DrawerTitle>ثبت تراکنش</DrawerTitle><DrawerDescription>روش ورود اطلاعات را انتخاب کنید.</DrawerDescription></DrawerHeader><div className="flex-1 overflow-y-auto overscroll-contain"><ChoiceButtons onChoose={onCaptureChange} /></div><Drawer onOpenChange={(open) => !open && closeNested()} open={capture === "clipboard"} showSwipeHandle><DrawerContent><DrawerHeader className="text-start"><DrawerTitle>ورود پیام بانکی</DrawerTitle><DrawerDescription>پیام به‌صورت پیش‌نویس ذخیره می‌شود و قبل از گزارش‌ها باید تأیید شود.</DrawerDescription></DrawerHeader><div className="flex-1 overflow-y-auto overscroll-contain p-4"><ClipboardImportForm active={capture === "clipboard"} onDone={() => { closeAll(); onCreated(); }} /></div></DrawerContent></Drawer><Drawer onOpenChange={(open) => !open && closeNested()} open={capture === "manual"} showSwipeHandle><DrawerContent><DrawerHeader className="text-start"><DrawerTitle>ثبت دستی تراکنش</DrawerTitle></DrawerHeader><div className="flex-1 overflow-y-auto overscroll-contain p-4"><ManualForm onDone={closeAll} /></div></DrawerContent></Drawer></DrawerContent></Drawer>;
}

function DesktopCaptureDialogs({ capture, onCaptureChange, onCreated }: { capture: CaptureStep | null; onCaptureChange: Dispatch<SetStateAction<CaptureStep | null>>; onCreated: () => void }) {
  return <>
    <CaptureDialog onChoose={onCaptureChange} onOpenChange={(open) => !open && onCaptureChange(null)} open={capture === "choose"} />
    <ClipboardImportDialog onCreated={onCreated} onOpenChange={(open) => !open && onCaptureChange(null)} open={capture === "clipboard"} />
    <ManualTransactionDialog onOpenChange={(open) => !open && onCaptureChange(null)} open={capture === "manual"} />
  </>;
}

export function CaptureSheet({ capture, onCaptureChange, onCreated }: { capture: CaptureStep | null; onCaptureChange: Dispatch<SetStateAction<CaptureStep | null>>; onCreated: () => void }) {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileCaptureSheet capture={capture} onCaptureChange={onCaptureChange} onCreated={onCreated} />;
  return <DesktopCaptureDialogs capture={capture} onCaptureChange={onCaptureChange} onCreated={onCreated} />;
}
