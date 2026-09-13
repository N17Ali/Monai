import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaptureChoices } from "./capture-choices";

export function CaptureDialog({ open, onOpenChange, onChoose }: { open: boolean; onOpenChange: (value: boolean) => void; onChoose: (choice: "clipboard" | "manual") => void }) {
  return <Dialog onOpenChange={onOpenChange} open={open}><DialogContent className="lg:w-[440px]"><DialogHeader><DialogTitle>ثبت تراکنش</DialogTitle><DialogDescription>روش ورود اطلاعات را انتخاب کنید.</DialogDescription></DialogHeader><CaptureChoices className="mt-5" onChoose={onChoose} /></DialogContent></Dialog>;
}
