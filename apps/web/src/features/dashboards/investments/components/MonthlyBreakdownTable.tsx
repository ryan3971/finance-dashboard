import { useState } from 'react';
import { cn, fmt, MONTH_LABELS } from '@/lib/utils';
import { SectionHelp } from '@/components/common/SectionHelp';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/common/EmptyState';
import type {
  AccountMonthlyBreakdown,
  AccountMonthlyBreakdownRow,
  AccountMonthlyBreakdownTotals,
  MonthlyBreakdownResponse,
  MonthlyBreakdownRow,
  MonthlyBreakdownTotals,
} from '@finance/shared/types/investments-monthly-breakdown';

const REGISTERED_TYPES = new Set(['tfsa', 'rrsp', 'fhsa']);

// ─── Shared helpers ───────────────────────────────────────────────────────────

function isFutureMonth(
  month: number,
  currentMonth: number,
  currentYear: number,
  selectedYear: number
): boolean {
  return (
    selectedYear > currentYear ||
    (selectedYear === currentYear && month > currentMonth)
  );
}

function uninvestedDeltaColor(delta: number): string {
  return delta > 0 ? 'text-warning' : 'text-content-secondary';
}

// ─── YTD Progress ─────────────────────────────────────────────────────────────

function ProgressBar({
  pct,
  colorClass,
}: {
  readonly pct: number;
  readonly colorClass: string;
}) {
  return (
    <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-300', colorClass)}
        style={{ width: `${Math.min(pct * 100, 100)}%` }}
      />
    </div>
  );
}

function AllAccountsYtd({
  data,
  selectedYear,
  currentYear,
  currentMonth,
}: {
  readonly data: MonthlyBreakdownResponse;
  readonly selectedYear: number;
  readonly currentYear: number;
  readonly currentMonth: number;
}) {
  const cutoff = selectedYear === currentYear ? currentMonth : 12;
  const ytdContributed = data.months
    .filter((m) => m.month <= cutoff)
    .reduce((sum, m) => sum + m.contributed, 0);

  const registeredAccounts = data.accounts.filter((a) => REGISTERED_TYPES.has(a.accountType));
  const accountsWithLimit = registeredAccounts.filter((a) => a.annualLimit !== null);
  const annualLimitTotal =
    accountsWithLimit.length > 0
      ? accountsWithLimit.reduce((sum, a) => sum + (a.annualLimit ?? 0), 0)
      : null;
  const partialLimits =
    accountsWithLimit.length > 0 && accountsWithLimit.length < registeredAccounts.length;

  const projection =
    selectedYear === currentYear ? (ytdContributed / currentMonth) * 12 : null;

  if (annualLimitTotal === null) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-mono font-semibold text-content-primary">
          {fmt(ytdContributed)} contributed YTD
        </p>
        {projection !== null && (
          <p className="text-xs text-content-secondary">
            Projected year-end: {fmt(projection)}
          </p>
        )}
      </div>
    );
  }

  const pct = ytdContributed / annualLimitTotal;
  const isOver = pct >= 1;
  const barColor = isOver ? 'bg-danger' : 'bg-positive';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-content-secondary">
          {fmt(ytdContributed)} / {fmt(annualLimitTotal)} annual limit
          {partialLimits && (
            <span className="ml-1 text-content-muted">
              (Partial — not all account limits entered)
            </span>
          )}
        </span>
      </div>
      <ProgressBar pct={pct} colorClass={barColor} />
      {projection !== null && ytdContributed > 0 && (
        <p className="text-xs text-content-secondary">
          Projected year-end: {fmt(projection)}
        </p>
      )}
    </div>
  );
}

function AccountYtd({
  account,
  selectedYear,
  currentYear,
  currentMonth,
}: {
  readonly account: AccountMonthlyBreakdown;
  readonly selectedYear: number;
  readonly currentYear: number;
  readonly currentMonth: number;
}) {
  const cutoff = selectedYear === currentYear ? currentMonth : 12;
  const ytdContributed = account.months
    .filter((m) => m.month <= cutoff)
    .reduce((sum, m) => sum + m.contributed, 0);

  if (account.annualLimit === null) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-mono font-semibold text-content-primary">
          {fmt(ytdContributed)} contributed YTD
        </p>
        {REGISTERED_TYPES.has(account.accountType) && (
          <p className="text-xs text-content-muted">
            Add your annual limit in the Contribution Room card to track progress
          </p>
        )}
      </div>
    );
  }

  const pct = ytdContributed / account.annualLimit;
  const barColor = pct >= 1 ? 'bg-danger' : pct >= 0.9 ? 'bg-warning' : 'bg-positive';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-content-secondary">
          {fmt(ytdContributed)} / {fmt(account.annualLimit)} annual limit
        </span>
        <span className="text-xs font-medium text-content-secondary">
          {(pct * 100).toFixed(1)}%
        </span>
      </div>
      <ProgressBar pct={pct} colorClass={barColor} />
    </div>
  );
}

// ─── Combined table (All Accounts) ───────────────────────────────────────────

function combinedContributedColor(
  contributed: number,
  target: number | null,
  isFuture: boolean
): string {
  if (target === null || isFuture) return 'text-content-secondary';
  return contributed >= target ? 'text-positive' : 'text-danger';
}

function CombinedMonthRow({
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
  const isFuture = isFutureMonth(row.month, currentMonth, currentYear, selectedYear);
  const isCurrent = selectedYear === currentYear && row.month === currentMonth;
  const monthLabel = MONTH_LABELS[row.month - 1] ?? '';
  const contribClass = combinedContributedColor(row.contributed, row.target, isFuture);

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
      <td className="px-4 py-3 text-right text-sm font-mono font-medium text-content-secondary">
        {row.target === null ? '—' : fmt(row.target)}
      </td>
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

function CombinedTotalsRow({ totals }: { readonly totals: MonthlyBreakdownTotals }) {
  const contribClass = combinedContributedColor(totals.contributed, totals.target, false);

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

function CombinedTable({
  months,
  totals,
  currentMonth,
  currentYear,
  selectedYear,
}: {
  readonly months: MonthlyBreakdownRow[];
  readonly totals: MonthlyBreakdownTotals;
  readonly currentMonth: number;
  readonly currentYear: number;
  readonly selectedYear: number;
}) {
  return (
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
          <CombinedMonthRow
            key={row.month}
            row={row}
            currentMonth={currentMonth}
            currentYear={currentYear}
            selectedYear={selectedYear}
          />
        ))}
      </tbody>
      <tfoot>
        <CombinedTotalsRow totals={totals} />
      </tfoot>
    </table>
  );
}

// ─── Per-account table ────────────────────────────────────────────────────────

function AccountMonthRow({
  row,
  currentMonth,
  currentYear,
  selectedYear,
}: {
  readonly row: AccountMonthlyBreakdownRow;
  readonly currentMonth: number;
  readonly currentYear: number;
  readonly selectedYear: number;
}) {
  const isFuture = isFutureMonth(row.month, currentMonth, currentYear, selectedYear);
  const isCurrent = selectedYear === currentYear && row.month === currentMonth;
  const monthLabel = MONTH_LABELS[row.month - 1] ?? '';

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
      <td className="px-4 py-3 text-right text-sm font-mono font-medium text-content-primary">
        {fmt(row.contributed)}
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

function AccountTotalsRow({ totals }: { readonly totals: AccountMonthlyBreakdownTotals }) {
  return (
    <tr className="border-t-2 border-border-base bg-surface-subtle font-semibold">
      <td className="px-4 py-3 text-sm text-content-primary">Total</td>
      <td className="px-4 py-3 text-right text-sm font-mono text-content-primary">
        {fmt(totals.contributed)}
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

function AccountTable({
  account,
  currentMonth,
  currentYear,
  selectedYear,
}: {
  readonly account: AccountMonthlyBreakdown;
  readonly currentMonth: number;
  readonly currentYear: number;
  readonly selectedYear: number;
}) {
  return (
    <table className="min-w-full divide-y divide-border-subtle">
      <thead className="bg-surface-subtle">
        <tr>
          <th className="th-class w-16 text-left">Month</th>
          <th className="th-class text-right">Contributed</th>
          <th className="th-class text-right">Deployed</th>
          <th className="th-class text-right">Uninvested Delta</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-subtle">
        {account.months.map((row) => (
          <AccountMonthRow
            key={row.month}
            row={row}
            currentMonth={currentMonth}
            currentYear={currentYear}
            selectedYear={selectedYear}
          />
        ))}
      </tbody>
      <tfoot>
        <AccountTotalsRow totals={account.totals} />
      </tfoot>
    </table>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  readonly data: MonthlyBreakdownResponse;
  readonly currentMonth: number;
  readonly currentYear: number;
  readonly selectedYear: number;
}

export function MonthlyBreakdownTable({
  data,
  currentMonth,
  currentYear,
  selectedYear,
}: Props) {
  const [activeTab, setActiveTab] = useState('all');

  const hasAnyData = data.months.some(
    (m) => m.contributed !== 0 || m.deployed !== 0 || m.target !== null
  );

  const activeAccount =
    activeTab !== 'all'
      ? data.accounts.find((a) => a.accountId === activeTab) ?? null
      : null;

  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-content-primary">Monthly Breakdown</h2>
            <SectionHelp contentKey="investments.monthlyBreakdown" />
          </div>
          {data.accounts.length > 0 && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All Accounts</TabsTrigger>
                {data.accounts.map((account) => (
                  <TabsTrigger key={account.accountId} value={account.accountId}>
                    {account.accountType.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>

        {activeAccount !== null ? (
          <>
            <p className="text-xs text-content-secondary">
              {activeAccount.accountName} · {activeAccount.institution}
            </p>
            <AccountYtd
              account={activeAccount}
              selectedYear={selectedYear}
              currentYear={currentYear}
              currentMonth={currentMonth}
            />
          </>
        ) : (
          <AllAccountsYtd
            data={data}
            selectedYear={selectedYear}
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
        )}
      </div>

      {activeAccount !== null ? (
        <div className="border-t border-border-base overflow-x-auto">
          <AccountTable
            account={activeAccount}
            currentMonth={currentMonth}
            currentYear={currentYear}
            selectedYear={selectedYear}
          />
        </div>
      ) : hasAnyData ? (
        <div className="border-t border-border-base overflow-x-auto">
          <CombinedTable
            months={data.months}
            totals={data.totals}
            currentMonth={currentMonth}
            currentYear={currentYear}
            selectedYear={selectedYear}
          />
        </div>
      ) : (
        <div className="border-t border-border-base">
          <EmptyState
            message="No investment data for this year."
            hint="Import a Questrade CSV or add a transaction to get started."
          />
        </div>
      )}
    </div>
  );
}
