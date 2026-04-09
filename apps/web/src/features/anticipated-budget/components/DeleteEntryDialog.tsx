import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

interface Props {
  readonly entryName: string | null;
  readonly isPending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function DeleteEntryDialog({
  entryName,
  isPending,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog
      open={entryName !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete budget entry?</DialogTitle>
          <DialogDescription>
            {entryName
              ? `"${entryName}" and all its month overrides will be permanently deleted.`
              : 'This entry will be permanently deleted.'}
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
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
