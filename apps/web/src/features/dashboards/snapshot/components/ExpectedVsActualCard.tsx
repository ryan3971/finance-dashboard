import { Link } from '@tanstack/react-router';
import type {
  SnapshotAnticipated,
  SnapshotColumnValues,
} from '@finance/shared/types/dashboard';
import { EmptyState } from '@/components/common/EmptyState';
import { fmt } from '@/lib/utils';

interface Props {
  readonly anticipated: SnapshotAnticipated;
  readonly monthlyExpenses: SnapshotColumnValues;
}

function TableRow({
  label,
  total,
  wants,
  needs,
  valueClass,
}: {
  readonly label: string;
  readonly total: number;
  readonly wants: number;
  readonly needs: number;
  readonly valueClass?: (v: number) => string;
}) {
  const cls = valueClass ?? (() => 'text-content-primary');
  return (
    <tr className="border-t border-border-subtle">
      <td className="px-4 py-3 text-sm text-content-secondary">{label}</td>
      <td
        className={`px-4 py-3 text-sm font-mono font-medium text-right ${cls(total)}`}
      >
        {fmt(total)}
      </td>
      <td
        className={`px-4 py-3 text-sm font-mono font-medium text-right ${cls(wants)}`}
      >
        {fmt(wants)}
      </td>
      <td
        className={`px-4 py-3 text-sm font-mono font-medium text-right ${cls(needs)}`}
      >
        {fmt(needs)}
      </td>
    </tr>
  );
}

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

function overBudgetAmount(actual: number, expected: number): number {
  return expected > 0 ? Math.max(actual - expected, 0) : 0;
}

export function ExpectedVsActualCard({ anticipated, monthlyExpenses }: Props) {
  if (!anticipated.hasEntries) {
    return (
      <div className="bg-surface rounded-lg border border-border-base p-6">
        <h2 className="text-lg font-semibold text-content-primary mb-4">
          Expected vs Actual
        </h2>
        <EmptyState
          message="No anticipated budget entries for this month."
          hint="Add entries in Anticipated Budget to see this comparison."
        />
        <p className="text-center mt-2">
          <Link
            to="/anticipated-budget"
            className="text-sm text-info underline"
          >
            Go to Anticipated Budget
          </Link>
        </p>
      </div>
    );
  }

  const {
    expectedSpendingIncome: esi,
    expectedExpenses: ee,
    expectedAvailable: ea,
    remainingBudget: rb,
  } = anticipated;

  const overTotal = overBudgetAmount(monthlyExpenses.total, esi.total);
  const overNeeds = overBudgetAmount(monthlyExpenses.needs, esi.needs);
  const overWants = overBudgetAmount(monthlyExpenses.wants, esi.wants);

  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="px-6 py-4 border-b border-border-base">
        <h2 className="text-lg font-semibold text-content-primary">
          Expected vs Actual
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
                  Total
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                  Wants
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                  Needs
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border-subtle">
                <td className="px-4 py-3 text-sm text-content-secondary">
                  Expected Income
                </td>
                <td className="px-4 py-3 text-sm font-mono font-medium text-right text-positive">
                  {fmt(anticipated.expectedIncome)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-content-muted">
                  —
                </td>
                <td className="px-4 py-3 text-sm text-right text-content-muted">
                  —
                </td>
              </tr>
              <TableRow
                label="Expected Spending"
                total={esi.total}
                wants={esi.wants}
                needs={esi.needs}
              />
              <TableRow
                label="Expected Expenses"
                total={ee.total}
                wants={ee.wants}
                needs={ee.needs}
                valueClass={(v) =>
                  v > 0 ? 'text-danger' : 'text-content-primary'
                }
              />
              <TableRow
                label="Expected Available"
                total={ea.total}
                wants={ea.wants}
                needs={ea.needs}
                valueClass={(v) => (v >= 0 ? 'text-positive' : 'text-danger')}
              />
              <TableRow
                label="Remaining Budget"
                total={rb.total}
                wants={rb.wants}
                needs={rb.needs}
                valueClass={(v) => (v >= 0 ? 'text-positive' : 'text-danger')}
              />
            </tbody>
          </table>
        </div>

        {/* Right: progress bars */}
        <div className="border-t border-border-base sm:border-t-0 sm:border-l px-6 py-5 space-y-5">
          <BudgetProgress
            label="Total"
            actual={monthlyExpenses.total}
            expected={esi.total}
            barClass="bg-info"
            overBarClass="bg-danger"
          />
          <BudgetProgress
            label="Wants"
            actual={monthlyExpenses.wants}
            expected={esi.wants}
            barClass="bg-warning"
            overBarClass="bg-danger"
          />
          <BudgetProgress
            label="Needs"
            actual={monthlyExpenses.needs}
            expected={esi.needs}
            barClass="bg-info"
            overBarClass="bg-danger"
          />

          {/* Over-budget callouts */}
          <div className="space-y-1.5 pt-1">
            {overTotal > 0 && (
              <p className="text-xs text-danger">
                Total is over budget — {fmt(overTotal)} over expected spending.
              </p>
            )}
            {overWants > 0 && (
              <p className="text-xs text-danger">
                Wants is over budget — {fmt(overWants)} over expected spending.
              </p>
            )}
            {overNeeds > 0 && (
              <p className="text-xs text-danger">
                Needs is over budget — {fmt(overNeeds)} over expected spending.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
