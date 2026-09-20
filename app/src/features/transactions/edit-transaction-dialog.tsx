import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { rialToToman } from "@shared/money";
import type { Transaction } from "@shared/contracts/transaction";
import { TransactionForm, transactionFormDate } from "./transaction-form";
import { useUpdateTransaction } from "./api";

function editDefaults(transaction: Transaction) {
  const kind = transaction.kind === "refund" || transaction.kind === "income" || transaction.kind === "transfer_in"
    ? transaction.kind === "refund" ? "income" : transaction.kind
    : transaction.kind === "transfer_out" ? "transfer_out" : "expense";
  return {
    kind,
    amountToman: rialToToman(transaction.amountRial),
    occurredAt: transactionFormDate(transaction.occurredAt),
    note: transaction.userNote ?? "",
  } as const;
}

export function EditTransactionDialog({ transaction, open, onOpenChange }: { transaction: Transaction | null; open: boolean; onOpenChange: (value: boolean) => void }) {
  const mutation = useUpdateTransaction();
  return <Drawer open={open && transaction != null} onOpenChange={onOpenChange} showSwipeHandle>
    <DrawerContent className="[--drawer-content-max-height:calc(100dvh-1rem)]">
      <DrawerHeader className="text-start">
        <DrawerTitle>ویرایش تراکنش</DrawerTitle>
        <DrawerDescription>اطلاعات تراکنش را اصلاح کن.</DrawerDescription>
      </DrawerHeader>
      <div className="p-4">
        {transaction && <TransactionForm key={transaction.id} defaultValues={editDefaults(transaction)} resetKey={transaction.id} pending={mutation.isPending} submitLabel="ذخیره تغییرات" onSubmit={(values) => mutation.mutate({ id: transaction.id, ...values }, { onSuccess: () => onOpenChange(false) })} />}
      </div>
    </DrawerContent>
  </Drawer>;
}
