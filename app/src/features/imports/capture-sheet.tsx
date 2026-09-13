import type { Dispatch, SetStateAction } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { CaptureChoices } from "./capture-choices";
import { CaptureDialog } from "./capture-dialog";
import { ClipboardImportDialog, ClipboardImportForm } from "./clipboard-import-dialog";
import { ManualForm, ManualTransactionDialog } from "@/features/transactions/manual-transaction-dialog";
import type { CaptureStep } from "./capture";

export type { CaptureStep } from "./capture";

function MobileCaptureSheet({ capture, onCaptureChange, onCreated }: { capture: CaptureStep | null; onCaptureChange: Dispatch<SetStateAction<CaptureStep | null>>; onCreated: () => void }) {
  const closeAll = () => onCaptureChange(null);
  const closeNested = () => onCaptureChange("choose");
  return <Drawer onOpenChange={(open) => !open && closeAll()} open={capture != null} showSwipeHandle><DrawerContent><DrawerHeader><DrawerTitle>ثبت تراکنش</DrawerTitle><DrawerDescription>روش ورود اطلاعات را انتخاب کنید.</DrawerDescription></DrawerHeader><div className="flex-1 overflow-y-auto overscroll-contain"><CaptureChoices className="p-4" onChoose={onCaptureChange} /></div><Drawer onOpenChange={(open) => !open && closeNested()} open={capture === "clipboard"} showSwipeHandle><DrawerContent><DrawerHeader className="text-start"><DrawerTitle>ورود پیام بانکی</DrawerTitle><DrawerDescription>پیام به‌صورت پیش‌نویس ذخیره می‌شود و قبل از گزارش‌ها باید تأیید شود.</DrawerDescription></DrawerHeader><div className="flex-1 overflow-y-auto overscroll-contain p-4"><ClipboardImportForm active={capture === "clipboard"} onDone={(next) => { closeAll(); if (next === "review") onCreated(); }} /></div></DrawerContent></Drawer><Drawer onOpenChange={(open) => !open && closeNested()} open={capture === "manual"} showSwipeHandle><DrawerContent><DrawerHeader className="text-start"><DrawerTitle>ثبت دستی تراکنش</DrawerTitle></DrawerHeader><div className="flex-1 overflow-y-auto overscroll-contain p-4"><ManualForm onDone={closeAll} /></div></DrawerContent></Drawer></DrawerContent></Drawer>;
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
