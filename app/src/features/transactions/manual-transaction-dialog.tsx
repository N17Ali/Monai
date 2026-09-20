import { newTransactionFormValues, TransactionForm } from "./transaction-form";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useManualTransaction } from "@/features/imports/capture";

export function ManualForm({ onDone }: { onDone: () => void }) {
  const mutation = useManualTransaction();
  return <TransactionForm defaultValues={newTransactionFormValues()} resetKey="new" pending={mutation.isPending} submitLabel="ثبت تراکنش" onSubmit={(values) => mutation.mutate(values, { onSuccess: onDone })} />;
}

export function ManualTransactionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  return <Drawer onOpenChange={onOpenChange} open={open} showSwipeHandle><DrawerContent><DrawerHeader className="text-start"><DrawerTitle>ثبت دستی تراکنش</DrawerTitle></DrawerHeader><div className="flex-1 overflow-y-auto overscroll-contain p-4"><ManualForm onDone={() => onOpenChange(false)} /></div></DrawerContent></Drawer>;
}
