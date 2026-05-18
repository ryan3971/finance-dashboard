import { cn, fmt, MONTH_LABELS } from '@/lib/utils';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import type {
  MonthlyBreakdownRow,
  MonthlyBreakdownTotals,
} from '@finance/shared/types/investments-monthly-breakdown';

interface Props {
  readonly months: MonthlyBreakdownRow[];
  readonly totals: MonthlyBreakdownTotals;
  readonly currentMonth: number;
  readonly currentYear: number;
  readonly selectedYear: number;
}

function contributedColor(
  contributed: number,
  target: number | null,
  month: number,
  currentMonth: number,
  currentYear: number,
  selectedYear: number
): string {
  if (target === null) return 'text-content-secondary';
  const isFuture =
    selectedYear > currentYear ||
    (selectedYear === currentYear && month > currentMonth);
  if (isFuture) return 'text-content-secondary';
  return contributed >= target ? 'text-positive' : 'text-danger';
}

function uninvestedDeltaColor(delta: number): string {
  return delta > 0 ? 'text-warning' : 'text-content-secondary';
}

function TargetCell({ target }: { readonly target: number | null }) {
  return (
    <td className="px-4 py-3 text-right text-sm font-mono font-medium text-content-secondary">
      {target === null ? '—' : fmt(target)}
    </td>
  );
}

function MonthRow({
  row,
  currentMonth,
  currentYear,
  selectedYear,
}: {
  readonly row: MonthlyBreakdownRow;
  readonly currentMonth: number;
  readonly currentYear: number;
  readonly selectedYear: number;
}) {
  const isFuture =
    selectedYear > currentYear ||
    (selectedYear === currentYear && row.month > currentMonth);
  const isCurrent = selectedYear === currentYear && row.month === currentMonth;

  const monthLabel = MONTH_LABELS[row.month - 1] ?? '';
  const contribClass = contributedColor(
    row.contributed,
    row.target,
    row.month,
    currentMonth,
    currentYear,
    selectedYear
  );

  return (
    <tr className="border-t border-border-subtle">
      <td
        className={cn(
          'px-4 py-3 text-sm w-16',
          isFuture && 'text-content-muted',
          isCurrent && 'font-semibold text-content-primary',
          !isFuture && !isCurrent && 'text-content-secondary'
        )}
      >
        {monthLabel}
      </td>
      <TargetCell target={row.target} />
      <td className="px-4 py-3 text-right text-sm font-mono font-medium">
        <span className={contribClass}>{fmt(row.contributed)}</span>
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono font-medium text-content-secondary">
        {fmt(row.deployed)}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono font-medium">
        <span className={uninvestedDeltaColor(row.uninvestedDelta)}>
          {fmt(row.uninvestedDelta)}
        </span>
      </td>
    </tr>
  );
}

function TotalsRow({
  totals,
  currentMonth,
  currentYear,
  selectedYear,
}: {
  readonly totals: MonthlyBreakdownTotals;
  readonly currentMonth: number;
  readonly currentYear: number;
  readonly selectedYear: number;
}) {
  // month=0 is never > currentMonth, so the totals row is never "future".
  const contribClass = contributedColor(
    totals.contributed,
    totals.target,
    0,
    currentMonth,
    currentYear,
    selectedYear
  );

  return (
    <tr className="border-t-2 border-border-base bg-surface-subtle font-semibold">
      <td className="px-4 py-3 text-sm text-content-primary">Total</td>
      <td className="px-4 py-3 text-right text-sm font-mono">
        {totals.target === null ? '—' : fmt(totals.target)}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono">
        <span className={contribClass}>{fmt(totals.contributed)}</span>
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono text-content-secondary">
        {fmt(totals.deployed)}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono">
        <span className={uninvestedDeltaColor(totals.uninvestedDelta)}>
          {fmt(totals.uninvestedDelta)}
        </span>
      </td>
    </tr>
  );
}

export function MonthlyBreakdownTable({
  months,
  totals,
  currentMonth,
  currentYear,
  selectedYear,
}: Props) {
  const hasAnyData = months.some(
    (m) => m.contributed !== 0 || m.deployed !== 0
  );
  const hasTarget = months.some((m) => m.target !== null);

  if (!hasAnyData && !hasTarget) {
    return (
      <EmptyState
        message="No investment data for this year."
        hint="Import a Questrade CSV or add a transaction to get started."
      />
    );
  }

  return (
    <DataTable>
      <table className="min-w-full divide-y divide-border-subtle">
        <thead className="bg-surface-subtle">
          <tr>
            <th className="th-class w-16 text-left">Month</th>
            <th className="th-class text-right">Target</th>
            <th className="th-class text-right">Contributed</th>
            <th className="th-class text-right">Deployed</th>
            <th className="th-class text-right">Uninvested Delta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {months.map((row) => (
            <MonthRow
              key={row.month}
              row={row}
              currentMonth={currentMonth}
              currentYear={currentYear}
              selectedYear={selectedYear}
            />
          ))}
        </tbody>
        <tfoot>
          <TotalsRow
            totals={totals}
            currentMonth={currentMonth}
            currentYear={currentYear}
            selectedYear={selectedYear}
          />
        </tfoot>
      </table>
    </DataTable>
  );
}
