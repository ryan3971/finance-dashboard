import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import type { Account } from '@/features/accounts/hooks/useAccounts';
import { Button } from '@/components/ui/Button';

interface Props {
  account: Account | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeactivateAccountDialog({
  account,
  isPending,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog
      open={account !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Deactivate account?</DialogTitle>
          <DialogDescription>
            {account
              ? `"${account.name}" will be hidden from filters and new imports. Existing transactions are not affected.`
              : 'This account will be deactivated.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="warning"
            size="sm"
            disabled={isPending}
            onClick={onConfirm}
          >
            Deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
