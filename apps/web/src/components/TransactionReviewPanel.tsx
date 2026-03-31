import {
  useConfirmTransfer,
  useDismissTransfer,
  usePatchTransaction,
} from '@/hooks/useTransactionMutations';
import { CategorySelect } from './CategorySelect';
import type { Transaction } from '@/hooks/useTransactions';
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
  const [needWant, setNeedWant] = useState<'Need' | 'Want' | 'NA' | ''>(
    (transaction.needWant as 'Need' | 'Want' | 'NA') ?? ''
  );
  const [note, setNote] = useState(transaction.note ?? '');
  const [createRule, setCreateRule] = useState(false);
  const [saving, setSaving] = useState(false);

  // Detect transfer candidates by description keywords
  const isTransferCandidate =
    transaction.flaggedForReview &&
    (transaction.description.includes('tfr') ||
      transaction.description.includes('transfer') ||
      transaction.description.includes('e-tfr') ||
      transaction.description.includes('payment'));

  async function handleSave() {
    setSaving(true);
    try {
      await patch.mutateAsync({
        id: transaction.id,
        input: {
          categoryId: categoryId || null,
          subcategoryId: subcategoryId || null,
          needWant: (needWant as 'Need' | 'Want' | 'NA') || null,
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
      await confirmTransfer.mutateAsync({
        transactionId: transaction.id,
      });
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
    <div className="bg-blue-50 border-t border-blue-100 px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          Review: {transaction.sourceName ?? transaction.description}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ✕
        </button>
      </div>

      {/* Transfer actions — shown when transfer keyword detected */}
      {isTransferCandidate && (
        <div className="flex gap-2 items-center p-3 bg-amber-50 border border-amber-200 rounded">
          <span className="text-xs text-amber-700 flex-1">
            This looks like an internal transfer. Confirm to exclude it from
            income/expense totals.
          </span>
          <button
            onClick={() => {
              void handleConfirmTransfer();
            }}
            disabled={saving}
            className="px-3 py-1 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 disabled:opacity-50"
          >
            Confirm transfer
          </button>
          <button
            onClick={() => {
              void handleDismissTransfer();
            }}
            disabled={saving}
            className="px-3 py-1 bg-white border border-gray-300 text-xs rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Not a transfer
          </button>
        </div>
      )}

      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Category
        </label>
        <CategorySelect
          categoryId={categoryId}
          subcategoryId={subcategoryId}
          onCategoryChange={setCategoryId}
          onSubcategoryChange={setSubcategoryId}
        />
      </div>

      {/* Need/Want */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Need / Want
        </label>
        <div className="flex gap-2">
          {(['Need', 'Want', 'NA'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setNeedWant(opt)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${
                needWant === opt
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Note
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note..."
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          maxLength={500}
        />
      </div>

      {/* Create rule */}
      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={createRule}
          onChange={(e) => setCreateRule(e.target.checked)}
          className="rounded"
        />
        Save as rule — apply this category to similar transactions in future
        imports
      </label>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            void handleSave();
          }}
          disabled={saving || !categoryId}
          className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
