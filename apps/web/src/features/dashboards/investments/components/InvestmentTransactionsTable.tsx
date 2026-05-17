import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { cn } from '@/lib/utils';
import type { InvestmentTransactionRow } from '@finance/shared/types/investments';
import type { InvestmentTransactionsResponse } from '../hooks/useInvestmentTransactions';

// ─── Action badge ─────────────────────────────────────────────────────────────

type BadgeVariant = 'info' | 'accent' | 'success' | 'warning' | 'neutral';

const ACTION_BADGE: Record<string, BadgeVariant> = {
  buy: 'info',
  sell: 'accent',
  dividend: 'success',
  deposit: 'success',
  withdrawal: 'warning',
  transfer: 'neutral',
  fee: 'neutral',
};

// ─── Amount display ───────────────────────────────────────────────────────────

function actionAmountClass(action: string): string {
  if (action === 'deposit' || action === 'dividend') return 'text-positive';
  if (action === 'withdrawal' || action === 'fee') return 'text-danger';
  return 'text-content-primary'; // buy, sell, transfer
}

function fmtInvAmount(amount: number): string {
  const abs = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(Math.abs(amount));
  return amount < 0 ? `-${abs}` : `+${abs}`;
}

// ─── Column toggle ────────────────────────────────────────────────────────────

const TOGGLE_COLS = [
  { key: 'quantity', label: 'Qty' },
  { key: 'price', label: 'Price' },
  { key: 'grossAmount', label: 'Gross' },
  { key: 'commission', label: 'Commission' },
  { key: 'currency', label: 'Currency' },
  { key: 'activityType', label: 'Activity' },
] as const;

type ToggleKey = (typeof TOGGLE_COLS)[number]['key'];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  readonly response: InvestmentTransactionsResponse | undefined;
  readonly isFetching: boolean;
  readonly page: number;
}

export function InvestmentTransactionsTable({ response, isFetching, page }: Props) {
  const navigate = useNavigate({ from: '/dashboard/investments' });
  const [visible, setVisible] = useState<Set<ToggleKey>>(new Set());

  function toggleCol(key: ToggleKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const rows = response?.data ?? [];
  const pagination = response?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  function setPage(p: number) {
    void navigate({ search: (prev) => ({ ...prev, page: p }) });
  }

  const toolbar = (
    <div className="flex flex-wrap gap-1">
      {TOGGLE_COLS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => toggleCol(key)}
          className={cn(
            'px-2 py-0.5 text-xs rounded border transition-colors',
            visible.has(key)
              ? 'border-content-primary bg-content-primary text-white'
              : 'border-border-strong text-content-secondary hover:bg-surface-subtle'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const footer =
    pagination && pagination.totalPages > 1 ? (
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(page - 1)}
        onNext={() => setPage(page + 1)}
      />
    ) : null;

  return (
    <DataTable
      toolbar={toolbar}
      footer={footer}
      className={cn('transition-opacity duration-200', isFetching && 'opacity-50')}
    >
      <table className="min-w-full divide-y divide-border-subtle">
        <thead className="bg-surface-subtle">
          <tr>
            <th className="th-cell">Date</th>
            <th className="th-cell">Account</th>
            <th className="th-cell">Action</th>
            <th className="th-cell">Symbol</th>
            <th className="th-cell">Description</th>
            {visible.has('quantity') && <th className="th-cell text-right">Qty</th>}
            {visible.has('price') && <th className="th-cell text-right">Price</th>}
            {visible.has('grossAmount') && <th className="th-cell text-right">Gross</th>}
            {visible.has('commission') && <th className="th-cell text-right">Commission</th>}
            {visible.has('currency') && <th className="th-cell">Currency</th>}
            {visible.has('activityType') && <th className="th-cell">Activity</th>}
            <th className="th-cell text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6 + visible.size} className="py-12">
                <EmptyState
                  message="No investment transactions found."
                  hint="Import a Questrade CSV to get started."
                />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <InvestmentRow key={row.id} row={row} visible={visible} />
            ))
          )}
        </tbody>
      </table>
    </DataTable>
  );
}

function InvestmentRow({
  row,
  visible,
}: {
  readonly row: InvestmentTransactionRow;
  readonly visible: Set<ToggleKey>;
}) {
  return (
    <tr>
      <td className="td-cell font-mono">{row.date}</td>
      <td className="td-cell">{row.accountName}</td>
      <td className="td-cell">
        <Badge variant={ACTION_BADGE[row.action] ?? 'neutral'}>{row.action}</Badge>
      </td>
      <td className="td-cell font-mono text-sm">
        {row.symbol ?? <span className="text-content-muted">—</span>}
      </td>
      <td className="td-cell max-w-xs truncate">{row.description ?? '—'}</td>
      {visible.has('quantity') && (
        <td className="td-cell text-right font-mono text-sm">
          {row.quantity !== null ? row.quantity.toFixed(2) : '—'}
        </td>
      )}
      {visible.has('price') && (
        <td className="td-cell text-right font-mono text-sm">
          {row.price !== null ? row.price.toFixed(4) : '—'}
        </td>
      )}
      {visible.has('grossAmount') && (
        <td className="td-cell text-right font-mono text-sm">
          {row.grossAmount !== null ? row.grossAmount.toFixed(2) : '—'}
        </td>
      )}
      {visible.has('commission') && (
        <td className="td-cell text-right font-mono text-sm">
          {row.commission !== null ? row.commission.toFixed(2) : '—'}
        </td>
      )}
      {visible.has('currency') && <td className="td-cell">{row.currency}</td>}
      {visible.has('activityType') && (
        <td className="td-cell text-content-muted">{row.activityType ?? '—'}</td>
      )}
      <td className="td-cell text-right">
        <span
          className={cn('font-mono text-sm font-medium', actionAmountClass(row.action))}
        >
          {fmtInvAmount(row.amount)}
        </span>
      </td>
    </tr>
  );
}
