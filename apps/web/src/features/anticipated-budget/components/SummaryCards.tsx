import type { AnticipatedBudgetEntry } from '@finance/shared';
import { MONTH_LABELS, fmt } from '@/lib/utils';

interface Props {
  readonly entries: AnticipatedBudgetEntry[];
  readonly month: number;
}

interface SummaryCardProps {
  readonly label: string;
  readonly value: number;
  readonly colorClass: string;
}

function SummaryCard({ label, value, colorClass }: SummaryCardProps) {
  return (
    <div className="bg-surface rounded-lg border border-border-base p-4">
      <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-lg font-semibold font-mono ${colorClass}`}>
        {fmt(value)}
      </p>
    </div>
  );
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
  const monthLabel = MONTH_LABELS[month - 1];

  const monthIncome = sumMonthAmounts(entries, (e) => e.isIncome, month);
  const monthExpenses = sumMonthAmounts(entries, (e) => !e.isIncome, month);
  const monthNet = monthIncome - monthExpenses;

  const yearIncome = sumYearAmounts(entries, (e) => e.isIncome);
  const yearExpenses = sumYearAmounts(entries, (e) => !e.isIncome);
  const yearNet = yearIncome - yearExpenses;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      <SummaryCard label={`${monthLabel} Income`} value={monthIncome} colorClass="text-positive" />
      <SummaryCard label={`${monthLabel} Expenses`} value={monthExpenses} colorClass="text-danger" />
      <SummaryCard
        label={`${monthLabel} Net`}
        value={monthNet}
        colorClass={monthNet >= 0 ? 'text-positive' : 'text-danger'}
      />
      <SummaryCard label="Annual Income" value={yearIncome} colorClass="text-positive" />
      <SummaryCard label="Annual Expenses" value={yearExpenses} colorClass="text-danger" />
      <SummaryCard
        label="Annual Net"
        value={yearNet}
        colorClass={yearNet >= 0 ? 'text-positive' : 'text-danger'}
      />
    </div>
  );
}
