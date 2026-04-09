import type { AnticipatedBudgetEntry } from '@finance/shared';
import { MONTH_LABELS, fmt } from '../utils/utils';

interface Props {
  readonly entries: AnticipatedBudgetEntry[];
  readonly month: number;
}

function sumMonthAmounts(
  entries: AnticipatedBudgetEntry[],
  filter: (e: AnticipatedBudgetEntry) => boolean,
  month: number
): number {
  return entries.filter(filter).reduce((sum, e) => {
    const m = e.months.find((mo) => mo.month === month);
    return sum + parseFloat(m?.amount ?? '0');
  }, 0);
}

function sumYearAmounts(
  entries: AnticipatedBudgetEntry[],
  filter: (e: AnticipatedBudgetEntry) => boolean
): number {
  return entries
    .filter(filter)
    .reduce(
      (sum, e) =>
        sum + e.months.reduce((ms, m) => ms + parseFloat(m.amount), 0),
      0
    );
}

export function SummaryCards({ entries, month }: Props) {
  const monthIncome = sumMonthAmounts(entries, (e) => e.isIncome, month);
  const monthExpenses = sumMonthAmounts(entries, (e) => !e.isIncome, month);
  const monthNet = monthIncome - monthExpenses;

  const yearIncome = sumYearAmounts(entries, (e) => e.isIncome);
  const yearExpenses = sumYearAmounts(entries, (e) => !e.isIncome);
  const yearNet = yearIncome - yearExpenses;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      <div className="bg-surface rounded-lg border border-border-base p-4">
        <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-1">
          {MONTH_LABELS[month - 1]} Income
        </p>
        <p className="text-lg font-semibold text-positive font-mono">
          {fmt(monthIncome)}
        </p>
      </div>
      <div className="bg-surface rounded-lg border border-border-base p-4">
        <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-1">
          {MONTH_LABELS[month - 1]} Expenses
        </p>
        <p className="text-lg font-semibold text-danger font-mono">
          {fmt(monthExpenses)}
        </p>
      </div>
      <div className="bg-surface rounded-lg border border-border-base p-4">
        <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-1">
          {MONTH_LABELS[month - 1]} Net
        </p>
        <p
          className={`text-lg font-semibold font-mono ${monthNet >= 0 ? 'text-positive' : 'text-danger'}`}
        >
          {fmt(monthNet)}
        </p>
      </div>
      <div className="bg-surface rounded-lg border border-border-base p-4">
        <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-1">
          Annual Income
        </p>
        <p className="text-lg font-semibold text-positive font-mono">
          {fmt(yearIncome)}
        </p>
      </div>
      <div className="bg-surface rounded-lg border border-border-base p-4">
        <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-1">
          Annual Expenses
        </p>
        <p className="text-lg font-semibold text-danger font-mono">
          {fmt(yearExpenses)}
        </p>
      </div>
      <div className="bg-surface rounded-lg border border-border-base p-4">
        <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-1">
          Annual Net
        </p>
        <p
          className={`text-lg font-semibold font-mono ${yearNet >= 0 ? 'text-positive' : 'text-danger'}`}
        >
          {fmt(yearNet)}
        </p>
      </div>
    </div>
  );
}
