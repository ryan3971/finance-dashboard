import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { IncomeMonth } from '@finance/shared';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { YearSelector } from '@/components/common/YearSelector';
import { MONTH_LABELS, fmt } from '@/lib/utils';
import { useIncomeDashboard } from './useIncomeDashboard';

function pct(part: string, total: string) {
  const t = Number(total);
  if (t === 0) return null;
  return ((Number(part) / t) * 100).toFixed(1) + '%';
}

function IncomeRow({ month }: { readonly month: IncomeMonth }) {
  const hasIncome = Number(month.total) > 0;
  return (
    <tr className="border-t border-border-subtle">
      <td className="px-4 py-3 text-sm text-content-secondary w-16">
        {MONTH_LABELS[month.month - 1]}
      </td>
      <td className="px-4 py-3 text-sm font-mono font-medium text-right">
        <span className={hasIncome ? 'text-positive' : 'text-content-muted'}>
          {fmt(Number(month.total))}
        </span>
      </td>
      {month.allocation !== null ? (
        <>
          <td className="px-4 py-3 text-sm text-right">
            <span className="font-mono font-medium text-info">
              {fmt(Number(month.allocation.needs))}
            </span>
            {hasIncome && (
              <span className="block text-xs text-content-muted">
                {pct(month.allocation.needs, month.total)}
              </span>
            )}
          </td>
          <td className="px-4 py-3 text-sm text-right">
            <span className="font-mono font-medium text-accent">
              {fmt(Number(month.allocation.wants))}
            </span>
            {hasIncome && (
              <span className="block text-xs text-content-muted">
                {pct(month.allocation.wants, month.total)}
              </span>
            )}
          </td>
          <td className="px-4 py-3 text-sm text-right">
            <span className="font-mono font-medium text-positive">
              {fmt(Number(month.allocation.investments))}
            </span>
            {hasIncome && (
              <span className="block text-xs text-content-muted">
                {pct(month.allocation.investments, month.total)}
              </span>
            )}
          </td>
        </>
      ) : (
        <td
          colSpan={3}
          className="px-4 py-3 text-sm text-content-muted text-center"
        >
          —
        </td>
      )}
    </tr>
  );
}

export function IncomePage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data, isLoading, isError } = useIncomeDashboard(year);

  const annualTotal =
    data?.months.reduce((sum, m) => sum + Number(m.total), 0) ?? 0;

  const allocationConfigured = data?.months.some((m) => m.allocation !== null);

  return (
    <PageLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-content-primary">Income</h1>
        <YearSelector year={year} onChange={setYear} />
      </div>

      {/* No-config banner */}
      {data && !allocationConfigured && (
        <div className="bg-info-bg border border-info-border rounded-lg px-4 py-3 text-sm text-info mb-6">
          Set your Needs / Wants / Investments allocation percentages in{' '}
          <Link to="/config" className="font-medium underline">
            Config → Preferences
          </Link>{' '}
          to see target breakdowns.
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
          <div className="px-4 py-2.5 bg-surface-subtle border-b border-border-subtle" />
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={`skeleton-${i}`}
              className="px-4 py-3 border-t border-border-subtle flex gap-4"
            >
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-24 ml-auto" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <EmptyState variant="error" message="Failed to load income data." />
      )}

      {/* Table */}
      {data && (
        <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-subtle">
                <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider w-16">
                  Month
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                  Total Income
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                  Needs
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                  Wants
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold text-content-muted uppercase tracking-wider text-right">
                  Investments
                </th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((month) => (
                <IncomeRow key={month.month} month={month} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Annual summary */}
      {data && (
        <div className="bg-surface rounded-lg border border-border-base p-6 mt-6">
          <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-1">
            Annual Income
          </p>
          <p className="text-2xl font-semibold text-positive font-mono">
            {fmt(annualTotal)}
          </p>
        </div>
      )}
    </PageLayout>
  );
}
