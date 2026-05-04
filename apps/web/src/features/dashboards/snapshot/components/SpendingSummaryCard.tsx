import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { SnapshotAnticipated, SnapshotColumnValues, SnapshotMonthlyIncome } from '@finance/shared/types/dashboard';
import { cn, fmt } from '@/lib/utils';

type ViewMode = 'budget' | 'income';

interface Props {
  readonly anticipated: SnapshotAnticipated;
  readonly monthlyExpenses: SnapshotColumnValues;
  readonly monthlyIncome: SnapshotMonthlyIncome;
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
  monthlyIncome,
}: Props) {
  const [mode, setMode] = useState<ViewMode>('budget');

  const { hasEntries, expectedExpenses, expectedSpendingIncome } = anticipated;
  const { spendingIncome, needs: incomeNeeds, wants: incomeWants, allocationConfigured } = monthlyIncome;

  // No budget → always income mode; toggle is hidden.
  const effectiveMode: ViewMode = hasEntries ? mode : 'income';

  // In income mode, needs/wants rows and bars only render when allocation is configured.
  const showAllocationBreakdown = effectiveMode === 'budget' || allocationConfigured;

  // ── Derived values by mode ──────────────────────────────────────────────────

  const colLabel = effectiveMode === 'budget' ? 'Budget' : 'Income';
  const overLabel = effectiveMode === 'budget' ? 'budget' : 'spending income';

  // Benchmarks drive progress bars, column display, and remaining calculations.
  const benchmarkTotal = effectiveMode === 'budget' ? expectedExpenses.total : spendingIncome;
  const benchmarkNeeds = effectiveMode === 'budget' ? expectedExpenses.needs : incomeNeeds;
  const benchmarkWants = effectiveMode === 'budget' ? expectedExpenses.wants : incomeWants;

  // "Budget/Income" column values — null renders as a dash in SummaryRow.
  const colTotal = benchmarkTotal;
  const colNeeds = showAllocationBreakdown ? benchmarkNeeds : null;
  const colWants = showAllocationBreakdown ? benchmarkWants : null;

  // Remaining = benchmark − actual for each category.
  const remainingNeeds = benchmarkNeeds - monthlyExpenses.needs;
  const remainingWants = benchmarkWants - monthlyExpenses.wants;
  const remainingTotal = benchmarkTotal - monthlyExpenses.total;

  const overTotal = overAmount(monthlyExpenses.total, benchmarkTotal);
  const overNeeds = overAmount(monthlyExpenses.needs, benchmarkNeeds);
  const overWants = overAmount(monthlyExpenses.wants, benchmarkWants);

  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="px-6 py-4 border-b border-border-base flex items-center justify-between">
        <h2 className="text-lg font-semibold text-content-primary">
          Spending Summary
        </h2>
        {hasEntries && (
          <div className="flex rounded border border-border-strong overflow-hidden">
            <button
              onClick={() => setMode('budget')}
              className={cn(
                'px-3 py-1 text-xs transition-colors',
                mode === 'budget'
                  ? 'bg-content-primary text-white'
                  : 'text-content-secondary hover:bg-surface-subtle'
              )}
            >
              Budget
            </button>
            <button
              onClick={() => setMode('income')}
              className={cn(
                'px-3 py-1 text-xs transition-colors border-l border-border-strong',
                mode === 'income'
                  ? 'bg-content-primary text-white'
                  : 'text-content-secondary hover:bg-surface-subtle'
              )}
            >
              Income
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
        {/* Left: table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-surface-subtle">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider w-2/5" />
                <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                  {colLabel}
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
              {showAllocationBreakdown && (
                <>
                  <SummaryRow
                    label="Needs"
                    budget={colNeeds}
                    actual={monthlyExpenses.needs}
                    remaining={remainingNeeds}
                  />
                  <SummaryRow
                    label="Wants"
                    budget={colWants}
                    actual={monthlyExpenses.wants}
                    remaining={remainingWants}
                  />
                </>
              )}
              <SummaryRow
                label="Total"
                budget={colTotal}
                actual={monthlyExpenses.total}
                remaining={remainingTotal}
                isTotal={showAllocationBreakdown}
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

          {/* Reference line — only shown in budget mode to avoid redundancy */}
          {effectiveMode === 'budget' && (
            <div className="px-4 py-2 border-t border-border-subtle">
              <p className="text-xs text-content-muted">
                Spending income: {fmt(spendingIncome)} &middot; Expected: {fmt(expectedSpendingIncome.total)}
              </p>
            </div>
          )}

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
            expected={benchmarkTotal}
            barClass="bg-info"
            overBarClass="bg-danger"
          />
          {showAllocationBreakdown && (
            <>
              <BudgetProgress
                label="Wants"
                actual={monthlyExpenses.wants}
                expected={benchmarkWants}
                barClass="bg-accent"
                overBarClass="bg-danger"
              />
              <BudgetProgress
                label="Needs"
                actual={monthlyExpenses.needs}
                expected={benchmarkNeeds}
                barClass="bg-info"
                overBarClass="bg-danger"
              />
            </>
          )}

          {/* Allocation not configured note — income mode only */}
          {effectiveMode === 'income' && !allocationConfigured && (
            <p className="text-xs text-content-muted">
              Allocation percentages not configured.{' '}
              <Link to="/config" className="text-info underline">
                Set them in Settings
              </Link>{' '}
              to see Needs/Wants breakdown.
            </p>
          )}

          {/* Over-budget callouts */}
          <div className="space-y-1.5 pt-1">
            {overTotal > 0 && (
              <p className="text-xs text-danger">
                Total is over {overLabel} — {fmt(overTotal)} over.
              </p>
            )}
            {showAllocationBreakdown && overWants > 0 && (
              <p className="text-xs text-danger">
                Wants is over {overLabel} — {fmt(overWants)} over.
              </p>
            )}
            {showAllocationBreakdown && overNeeds > 0 && (
              <p className="text-xs text-danger">
                Needs is over {overLabel} — {fmt(overNeeds)} over.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
