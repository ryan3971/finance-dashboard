import {
  FIELD_LIMITS,
  NEED_WANT_OPTIONS,
  type NeedWant,
  TRANSFER_KEYWORDS,
} from '@finance/shared';
import {
  useConfirmTransfer,
  useDismissTransfer,
  usePatchTransaction,
} from '@/features/transactions/hooks/useTransactionMutations';
import { Button } from '@/components/ui/Button';
import { CategorySelect } from '@/components/common/CategorySelect';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/Input';
import type { Transaction } from '@/features/transactions/hooks/useTransactions';
import { useState } from 'react';

interface Props {
  readonly transaction: Transaction;
  readonly onClose: () => void;
}

export function TransactionReviewPanel({ transaction, onClose }: Props) {
  const patch = usePatchTransaction();
  const confirmTransfer = useConfirmTransfer();
  const dismissTransfer = useDismissTransfer();

  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? '');
  const [subcategoryId, setSubcategoryId] = useState(
    transaction.subcategoryId ?? ''
  );
  const [needWant, setNeedWant] = useState<NeedWant | ''>(
    transaction.needWant ?? ''
  );
  const [note, setNote] = useState(transaction.note ?? '');
  const [createRule, setCreateRule] = useState(false);
  const [saving, setSaving] = useState(false);

  const isTransferCandidate =
    transaction.flaggedForReview &&
    TRANSFER_KEYWORDS.some((k) => transaction.description.includes(k));

  async function handleSave() {
    setSaving(true);
    try {
      await patch.mutateAsync({
        id: transaction.id,
        input: {
          categoryId: categoryId || null,
          subcategoryId: subcategoryId || null,
          needWant: needWant || null,
          note: note || null,
          createRule,
        },
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmTransfer() {
    setSaving(true);
    try {
      await confirmTransfer.mutateAsync({ transactionId: transaction.id });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDismissTransfer() {
    setSaving(true);
    try {
      await dismissTransfer.mutateAsync(transaction.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-info-bg border-t border-info-border px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-content-primary">
          Review: {transaction.sourceName ?? transaction.description}
        </h3>
        <button
          onClick={onClose}
          className="text-content-muted hover:text-content-secondary text-sm"
        >
          ✕
        </button>
      </div>

      {isTransferCandidate && (
        <div className="flex gap-2 items-center p-3 bg-warning-bg border border-warning-border rounded">
          <span className="text-xs text-warning flex-1">
            This looks like an internal transfer. Confirm to exclude it from
            income/expense totals.
          </span>
          <Button
            variant="warning"
            size="sm"
            onClick={() => {
              void handleConfirmTransfer();
            }}
            disabled={saving}
          >
            Confirm transfer
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void handleDismissTransfer();
            }}
            disabled={saving}
          >
            Not a transfer
          </Button>
        </div>
      )}

      <FormField label="Category" labelSize="xs">
        <CategorySelect
          categoryId={categoryId}
          subcategoryId={subcategoryId}
          onCategoryChange={setCategoryId}
          onSubcategoryChange={setSubcategoryId}
        />
      </FormField>

      <div>
        <label className="label-xs">Need / Want</label>
        <div className="flex gap-2">
          {NEED_WANT_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setNeedWant(opt)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${
                needWant === opt
                  ? 'bg-content-primary text-white border-content-primary'
                  : 'border-border-strong text-content-secondary hover:bg-surface-subtle'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <FormField label="Note" labelSize="xs">
        <Input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note..."
          maxLength={FIELD_LIMITS.NOTE_MAX}
          className="px-2 py-1.5 rounded"
        />
      </FormField>

      <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={createRule}
          onChange={(e) => setCreateRule(e.target.checked)}
          className="rounded"
        />
        Save as rule — apply this category to similar transactions in future
        imports
      </label>

      <div className="flex gap-2">
        <Button
          onClick={() => {
            void handleSave();
          }}
          disabled={saving || !categoryId}
          size="md"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="secondary" size="md" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
