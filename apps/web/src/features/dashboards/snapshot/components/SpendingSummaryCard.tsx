import { Link } from '@tanstack/react-router';
import type { SnapshotAnticipated, SnapshotColumnValues } from '@finance/shared/types/dashboard';
import { fmt } from '@/lib/utils';

interface Props {
  readonly anticipated: SnapshotAnticipated;
  readonly monthlyExpenses: SnapshotColumnValues;
  readonly spendingIncome: number;
}

// ── Summary table row ────────────────────────────────────────────────────────

function SummaryRow({
  label,
  budget,
  actual,
  remaining,
  isTotal,
}: {
  readonly label: string;
  readonly budget: number | null;
  readonly actual: number;
  readonly remaining: number;
  readonly isTotal?: boolean;
}) {
  const remainingClass = remaining >= 0 ? 'text-positive' : 'text-danger';
  const rowClass = isTotal
    ? 'border-t-2 border-border-base'
    : 'border-t border-border-subtle';

  return (
    <tr className={rowClass}>
      <td className="px-4 py-3 text-sm text-content-secondary">{label}</td>
      <td className="px-4 py-3 text-sm font-mono font-medium text-right text-content-muted">
        {budget !== null ? fmt(budget) : '—'}
      </td>
      <td className="px-4 py-3 text-sm font-mono font-medium text-right text-danger">
        {fmt(actual)}
      </td>
      <td
        className={`px-4 py-3 text-sm font-mono font-medium text-right ${remainingClass}`}
      >
        {fmt(remaining)}
      </td>
    </tr>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function BudgetProgress({
  label,
  actual,
  expected,
  barClass,
  overBarClass,
}: {
  readonly label: string;
  readonly actual: number;
  readonly expected: number;
  readonly barClass: string;
  readonly overBarClass: string;
}) {
  const ratio = expected > 0 ? actual / expected : 0;
  const fillPct = Math.min(ratio * 100, 100);
  const isOver = ratio > 1;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-content-secondary">
          {label}
        </span>
        <span
          className={`text-xs font-semibold font-mono ${isOver ? 'text-danger' : 'text-content-secondary'}`}
        >
          {(ratio * 100).toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-2.5 bg-surface-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOver ? overBarClass : barClass}`}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
}

function overAmount(actual: number, benchmark: number): number {
  return benchmark > 0 ? Math.max(actual - benchmark, 0) : 0;
}

// ── Card ─────────────────────────────────────────────────────────────────────

export function SpendingSummaryCard({
  anticipated,
  monthlyExpenses,
  spendingIncome,
}: Props) {
  const { hasEntries, expectedExpenses: ee, expectedSpendingIncome: esi } =
    anticipated;

  // Progress bar benchmark: planned expenses when a budget exists, spending
  // income as a fallback so the bars are always meaningful.
  const benchmark = hasEntries ? ee : esi;

  // Budget column shows planned expenses; null renders as a dash.
  const budgetNeeds = hasEntries ? ee.needs : null;
  const budgetWants = hasEntries ? ee.wants : null;
  const budgetTotal = hasEntries ? ee.total : null;

  // Remaining = budget (or spending income fallback) minus actual.
  const remainingNeeds = (budgetNeeds ?? esi.needs) - monthlyExpenses.needs;
  const remainingWants = (budgetWants ?? esi.wants) - monthlyExpenses.wants;
  const remainingTotal = (budgetTotal ?? esi.total) - monthlyExpenses.total;

  const overTotal = overAmount(monthlyExpenses.total, benchmark.total);
  const overNeeds = overAmount(monthlyExpenses.needs, benchmark.needs);
  const overWants = overAmount(monthlyExpenses.wants, benchmark.wants);

  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="px-6 py-4 border-b border-border-base">
        <h2 className="text-lg font-semibold text-content-primary">
          Spending Summary
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
        {/* Left: table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-surface-subtle">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider w-2/5" />
                <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                  Actual
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                  Remaining
                </th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow
                label="Needs"
                budget={budgetNeeds}
                actual={monthlyExpenses.needs}
                remaining={remainingNeeds}
              />
              <SummaryRow
                label="Wants"
                budget={budgetWants}
                actual={monthlyExpenses.wants}
                remaining={remainingWants}
              />
              <SummaryRow
                label="Total"
                budget={budgetTotal}
                actual={monthlyExpenses.total}
                remaining={remainingTotal}
                isTotal
              />
              {monthlyExpenses.rebalancingAdjustment > 0 && (
                <tr className="border-t border-border-subtle bg-surface-subtle">
                  <td className="px-4 py-2 text-xs text-content-muted pl-8">
                    Less Rebalancing
                  </td>
                  <td className="px-4 py-2 text-xs text-right text-content-muted">
                    —
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-right text-content-muted">
                    {fmt(-monthlyExpenses.rebalancingAdjustment)}
                  </td>
                  <td className="px-4 py-2 text-xs text-right text-content-muted">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Reference line */}
          <div className="px-4 py-2 border-t border-border-subtle">
            <p className="text-xs text-content-muted">
              Spending income: {fmt(spendingIncome)}
              {hasEntries && (
                <> &middot; Expected: {fmt(esi.total)}</>
              )}
            </p>
          </div>

          {!hasEntries && (
            <p className="px-4 pb-3 text-xs text-content-muted">
              No budget entries —{' '}
              <Link to="/anticipated-budget" className="text-info underline">
                add an anticipated budget
              </Link>{' '}
              to compare against a plan. Progress bars show spending income.
            </p>
          )}
        </div>

        {/* Right: progress bars */}
        <div className="border-t border-border-base sm:border-t-0 sm:border-l px-6 py-5 space-y-5">
          <BudgetProgress
            label="Total"
            actual={monthlyExpenses.total}
            expected={benchmark.total}
            barClass="bg-info"
            overBarClass="bg-danger"
          />
          <BudgetProgress
            label="Wants"
            actual={monthlyExpenses.wants}
            expected={benchmark.wants}
            barClass="bg-accent"
            overBarClass="bg-danger"
          />
          <BudgetProgress
            label="Needs"
            actual={monthlyExpenses.needs}
            expected={benchmark.needs}
            barClass="bg-info"
            overBarClass="bg-danger"
          />

          {/* Over-budget callouts */}
          <div className="space-y-1.5 pt-1">
            {overTotal > 0 && (
              <p className="text-xs text-danger">
                Total is over {hasEntries ? 'budget' : 'expected spending'} —{' '}
                {fmt(overTotal)} over.
              </p>
            )}
            {overWants > 0 && (
              <p className="text-xs text-danger">
                Wants is over {hasEntries ? 'budget' : 'expected spending'} —{' '}
                {fmt(overWants)} over.
              </p>
            )}
            {overNeeds > 0 && (
              <p className="text-xs text-danger">
                Needs is over {hasEntries ? 'budget' : 'expected spending'} —{' '}
                {fmt(overNeeds)} over.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
