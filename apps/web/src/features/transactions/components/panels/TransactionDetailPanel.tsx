import type React from 'react';
import { AmountCell } from '@/features/transactions/components/table/AmountCell';
import { Badge } from '@/components/ui/Badge';
import type { Tag, Transaction } from '@/features/transactions/hooks/useTransactions';

interface Props {
  readonly transaction: Transaction;
  readonly onClose: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function CategoryField({ transaction }: { readonly transaction: Transaction }) {
  if (!transaction.categoryName) return <span>—</span>;

  const path = transaction.subcategoryName
    ? `${transaction.categoryName} › ${transaction.subcategoryName}`
    : transaction.categoryName;

  let badge: React.ReactNode = null;
  if (transaction.needWant === 'Need') {
    badge = <Badge variant="info" rounded="sm" className="ml-1.5">Need</Badge>;
  } else if (transaction.needWant === 'Want') {
    badge = <Badge variant="accent" rounded="sm" className="ml-1.5">Want</Badge>;
  }

  return (
    <span className="inline-flex items-center flex-wrap gap-y-1">
      {path}
      {badge}
    </span>
  );
}

function TagsField({ tags }: { readonly tags: Tag[] }) {
  if (tags.length === 0) return <span>—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: tag.color ?? '#6B7280' }}
        >
          {tag.name}
        </span>
      ))}
    </span>
  );
}

type DetailField =
  | { label: string; value: string | null }
  | { label: string; render: () => React.ReactNode };

export function TransactionDetailPanel({ transaction, onClose }: Props) {
  const fields: DetailField[] = [
    { label: 'Date', value: formatDate(transaction.date) },
    { label: 'Amount', render: () => <AmountCell amount={transaction.amount} isTransfer={transaction.isTransfer} /> },
    { label: 'Account', value: transaction.accountName },
    { label: 'Category', render: () => <CategoryField transaction={transaction} /> },
    { label: 'Note', value: transaction.note },
    { label: 'Tags', render: () => <TagsField tags={transaction.tags} /> },
  ];

  return (
    <div className="bg-info-bg border-t border-info-border px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-content-primary truncate pr-4">
          {transaction.sourceName ?? transaction.description}
        </span>
        <button
          onClick={onClose}
          className="shrink-0 text-content-muted hover:text-content-primary transition-colors"
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs text-content-muted">{field.label}</dt>
            <dd className="text-sm text-content-primary mt-0.5">
              {'render' in field ? field.render() : (field.value ?? '—')}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
