import { memo, useCallback, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { cn, fmtInvestmentAmount } from '@/lib/utils';
import type {
  InvestmentTransactionRow,
  InvestmentTransactionsResponse,
  RiskLevel,
} from '@finance/shared/types/investments';
import { useUpdateRiskLevel } from '../hooks/useRiskBudgetMutations';

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

function actionAmountClass(action: string): string {
  if (action === 'deposit' || action === 'dividend') return 'text-positive';
  if (action === 'withdrawal' || action === 'fee') return 'text-danger';
  return 'text-content-primary'; // buy, sell, transfer
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

function ColumnToggle({
  visible,
  onToggle,
}: {
  readonly visible: ToggleKey[];
  readonly onToggle: (key: ToggleKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {TOGGLE_COLS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onToggle(key)}
          className={cn(
            'px-2 py-0.5 text-xs rounded border transition-colors',
            visible.includes(key)
              ? 'border-content-primary bg-content-primary text-white'
              : 'border-border-strong text-content-secondary hover:bg-surface-subtle'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Row (memoised) ──────────────────────────────────────────────────────────

const InvestmentRow = memo(
  function InvestmentRow({
    row,
    visible,
    onToggleRiskLevel,
    onDuplicate,
  }: {
    readonly row: InvestmentTransactionRow;
    readonly visible: ToggleKey[];
    readonly onToggleRiskLevel: (id: string, next: RiskLevel) => void;
    readonly onDuplicate: (row: InvestmentTransactionRow) => void;
  }) {
    const isBuy = row.action === 'buy';
    const effectiveRiskLevel = row.riskLevel ?? 'regular';
    const nextRiskLevel: RiskLevel = effectiveRiskLevel === 'risky' ? 'regular' : 'risky';

    return (
      <tr className="group">
        <td className="td-cell font-mono">{row.date}</td>
        <td className="td-cell">{row.accountName}</td>
        <td className="td-cell">
          <Badge variant={ACTION_BADGE[row.action] ?? 'neutral'}>{row.action}</Badge>
        </td>
        <td className="td-cell font-mono text-sm">
          {row.symbol ?? <span className="text-content-muted">—</span>}
        </td>
        <td className="td-cell max-w-xs truncate">{row.description ?? '—'}</td>
        {visible.includes('quantity') && (
          <td className="td-cell text-right font-mono text-sm">
            {row.quantity !== null ? row.quantity.toFixed(2) : '—'}
          </td>
        )}
        {visible.includes('price') && (
          <td className="td-cell text-right font-mono text-sm">
            {row.price !== null ? row.price.toFixed(4) : '—'}
          </td>
        )}
        {visible.includes('grossAmount') && (
          <td className="td-cell text-right font-mono text-sm">
            {row.grossAmount !== null ? row.grossAmount.toFixed(2) : '—'}
          </td>
        )}
        {visible.includes('commission') && (
          <td className="td-cell text-right font-mono text-sm">
            {row.commission !== null ? row.commission.toFixed(2) : '—'}
          </td>
        )}
        {visible.includes('currency') && <td className="td-cell">{row.currency}</td>}
        {visible.includes('activityType') && (
          <td className="td-cell text-content-muted">{row.activityType ?? '—'}</td>
        )}
        <td className="td-cell">
          {isBuy ? (
            <span className="group">
              <button
                onClick={() => onToggleRiskLevel(row.id, nextRiskLevel)}
                className="focus:outline-none"
                aria-label={`Mark as ${nextRiskLevel}`}
              >
                <Badge variant={effectiveRiskLevel === 'risky' ? 'warning' : 'neutral'}>
                  {effectiveRiskLevel}
                </Badge>
              </button>
            </span>
          ) : (
            <span className="text-content-muted text-sm">—</span>
          )}
        </td>
        <td className="td-cell text-right">
          <span className={cn('font-mono text-sm font-medium', actionAmountClass(row.action))}>
            {fmtInvestmentAmount(row.amount)}
          </span>
        </td>
        <td className="td-cell text-right">
          <button
            onClick={() => onDuplicate(row)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-content-muted hover:text-content-primary"
          >
            Duplicate
          </button>
        </td>
      </tr>
    );
  },
  // Custom comparator: re-render only when the row data, visible columns, or callback references change.
  (prev, next) =>
    prev.row === next.row &&
    prev.onToggleRiskLevel === next.onToggleRiskLevel &&
    prev.onDuplicate === next.onDuplicate &&
    prev.visible.length === next.visible.length &&
    prev.visible.every((k, i) => k === next.visible[i])
);

// ─── Table ────────────────────────────────────────────────────────────────────

interface Props {
  readonly response: InvestmentTransactionsResponse | undefined;
  readonly isFetching: boolean;
  readonly page: number;
  readonly onDuplicate?: (row: InvestmentTransactionRow) => void;
}

export function InvestmentTransactionsTable({ response, isFetching, page, onDuplicate }: Props) {
  const navigate = useNavigate({ from: '/dashboard/investments' });
  const [visible, setVisible] = useState<ToggleKey[]>([]);
  const riskLevelMutation = useUpdateRiskLevel();

  function toggleCol(key: ToggleKey) {
    setVisible((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const handleToggleRiskLevel = useCallback(
    (id: string, next: RiskLevel) => {
      riskLevelMutation.mutate({ id, body: { riskLevel: next } });
    },
    [riskLevelMutation]
  );

  const handleDuplicate = useCallback(
    (row: InvestmentTransactionRow) => {
      onDuplicate?.(row);
    },
    [onDuplicate]
  );

  const rows = response?.data ?? [];
  const pagination = response?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  function setPage(p: number) {
    void navigate({ search: (prev) => ({ ...prev, page: p }) });
  }

  // Base column count: Date, Account, Action, Symbol, Description, Risk, Amount, Actions = 8
  const baseColCount = 8;

  return (
    <DataTable
      toolbar={<ColumnToggle visible={visible} onToggle={toggleCol} />}
      footer={
        pagination && pagination.totalPages > 1 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
          />
        ) : null
      }
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
            {visible.includes('quantity') && <th className="th-cell text-right">Qty</th>}
            {visible.includes('price') && <th className="th-cell text-right">Price</th>}
            {visible.includes('grossAmount') && <th className="th-cell text-right">Gross</th>}
            {visible.includes('commission') && (
              <th className="th-cell text-right">Commission</th>
            )}
            {visible.includes('currency') && <th className="th-cell">Currency</th>}
            {visible.includes('activityType') && <th className="th-cell">Activity</th>}
            <th className="th-cell">Risk</th>
            <th className="th-cell text-right">Amount</th>
            <th className="th-cell"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={baseColCount + visible.length} className="py-12">
                <EmptyState
                  message="No investment transactions found."
                  hint="Import a Questrade CSV to get started."
                />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <InvestmentRow
                key={row.id}
                row={row}
                visible={visible}
                onToggleRiskLevel={handleToggleRiskLevel}
                onDuplicate={handleDuplicate}
              />
            ))
          )}
        </tbody>
      </table>
    </DataTable>
  );
}
