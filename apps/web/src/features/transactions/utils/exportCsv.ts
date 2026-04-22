import type { FilterState } from '@/features/transactions/components/filters/filterState';
import type { Transaction } from '@finance/shared/schemas/transactions';

const EXPORT_COLUMNS: { header: string; getValue: (t: Transaction) => string | null | undefined }[] = [
  { header: 'date',        getValue: (t) => t.date },
  { header: 'description', getValue: (t) => t.sourceName ?? t.description },
  { header: 'amount',      getValue: (t) => t.amount },
  { header: 'account',     getValue: (t) => t.accountName },
  { header: 'category',    getValue: (t) => t.categoryName },
  { header: 'subcategory', getValue: (t) => t.subcategoryName },
  { header: 'needWant',    getValue: (t) => t.needWant },
  { header: 'tags',        getValue: (t) => t.tags.map((tag) => tag.name).join(' | ') },
  { header: 'note',        getValue: (t) => t.note },
  { header: 'source',      getValue: (t) => (t.source === 'manual' ? 'manual' : 'imported') },
  { header: 'transfer',    getValue: (t) => (t.isTransfer ? 'Yes' : 'No') },
];

function csvField(v: string | null | undefined) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function buildExportFilename(filters: FilterState) {
  if (filters.startDate && filters.endDate) {
    return `transactions-${filters.startDate}-to-${filters.endDate}.csv`;
  }
  if (filters.startDate) return `transactions-from-${filters.startDate}.csv`;
  if (filters.endDate) return `transactions-to-${filters.endDate}.csv`;
  return 'transactions-all.csv';
}

export function triggerCsvDownload(transactions: Transaction[], filters: FilterState) {
  const header = EXPORT_COLUMNS.map((col) => col.header).join(',');
  const rows = transactions.map((t) =>
    EXPORT_COLUMNS.map((col) => csvField(col.getValue(t))).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildExportFilename(filters);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
