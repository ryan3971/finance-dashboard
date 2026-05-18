import { fmt } from '@/lib/utils';
import type { MonthlyBreakdownRow } from '@finance/shared/types/investments-monthly-breakdown';
import type { AccountContributionSummary } from '@finance/shared/types/investments';

interface Props {
  readonly months: MonthlyBreakdownRow[];
  readonly selectedYear: number;
  readonly currentYear: number;
  readonly currentMonth: number;
  readonly accounts: AccountContributionSummary[];
}

interface YtdStats {
  contributed: number;
  target: number | null;
  projection: number | null;
  annualLimitTotal: number | null;
  partialLimits: boolean;
}

function computeYtd(
  months: MonthlyBreakdownRow[],
  selectedYear: number,
  currentYear: number,
  currentMonth: number,
  accounts: AccountContributionSummary[]
): YtdStats {
  const isCurrentYear = selectedYear === currentYear;
  const cutoffMonth = isCurrentYear ? currentMonth : 12;

  const ytdMonths = months.filter((m) => m.month <= cutoffMonth);

  const contributed = ytdMonths.reduce((sum, m) => sum + m.contributed, 0);

  const anyNullTarget = ytdMonths.some((m) => m.target === null);
  const target = anyNullTarget
    ? null
    : ytdMonths.reduce((sum, m) => sum + (m.target ?? 0), 0);

  // Projection only shown for the current year (past years are complete).
  const projection = isCurrentYear ? (contributed / currentMonth) * 12 : null;

  // Progress bar: sum annualLimit for accounts that have one set.
  const accountsWithLimit = accounts.filter((a) => a.annualLimit !== null);
  const allHaveLimit = accountsWithLimit.length === accounts.length;
  const someHaveLimit = accountsWithLimit.length > 0;

  const annualLimitTotal = someHaveLimit
    ? accountsWithLimit.reduce((sum, a) => sum + (a.annualLimit ?? 0), 0)
    : null;

  const partialLimits = someHaveLimit && !allHaveLimit;

  return { contributed, target, projection, annualLimitTotal, partialLimits };
}

function AnnualLimitDisplay({
  contributed,
  annualLimitTotal,
  partialLimits,
}: {
  readonly contributed: number;
  readonly annualLimitTotal: number;
  readonly partialLimits: boolean;
}) {
  if (partialLimits) {
    return (
      <p className="text-xs text-content-secondary">
        {fmt(contributed)} of {fmt(annualLimitTotal)} annual limit
        <span className="ml-1 text-content-muted">
          (Partial — not all account limits entered)
        </span>
      </p>
    );
  }

  const pct = Math.min((contributed / annualLimitTotal) * 100, 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-content-secondary">
          {fmt(contributed)} of {fmt(annualLimitTotal)} annual limit
        </span>
        <span className="text-xs font-medium text-content-secondary">
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-positive transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function YtdProgressSection({
  months,
  selectedYear,
  currentYear,
  currentMonth,
  accounts,
}: Props) {
  const stats = computeYtd(months, selectedYear, currentYear, currentMonth, accounts);

  return (
    <div className="bg-surface rounded-lg border border-border-base p-6 space-y-4">
      <h2 className="text-sm font-semibold text-content-primary">
        {selectedYear === currentYear ? 'Year-to-Date Progress' : `${selectedYear} Summary`}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-content-muted mb-1">YTD Contributed</p>
          <p className="text-lg font-semibold font-mono text-content-primary">
            {fmt(stats.contributed)}
          </p>
        </div>

        <div>
          <p className="text-xs text-content-muted mb-1">YTD Target</p>
          <p className="text-lg font-semibold font-mono text-content-secondary">
            {stats.target === null ? '—' : fmt(stats.target)}
          </p>
        </div>

        {stats.target !== null && (
          <div>
            <p className="text-xs text-content-muted mb-1">vs Target</p>
            <p
              className={`text-lg font-semibold font-mono ${
                stats.contributed >= stats.target ? 'text-positive' : 'text-danger'
              }`}
            >
              {fmt(stats.contributed - stats.target)}
            </p>
          </div>
        )}

        {stats.projection !== null && (
          <div>
            <p className="text-xs text-content-muted mb-1">Year-End Projection</p>
            <p className="text-lg font-semibold font-mono text-content-secondary">
              {fmt(stats.projection)}
            </p>
          </div>
        )}
      </div>

      {stats.annualLimitTotal !== null && (
        <AnnualLimitDisplay
          contributed={stats.contributed}
          annualLimitTotal={stats.annualLimitTotal}
          partialLimits={stats.partialLimits}
        />
      )}
    </div>
  );
}
