import { Link } from '@tanstack/react-router';
import type { SnapshotAnticipated, SnapshotMonthlyIncome } from '@finance/shared/types/dashboard';
import { fmt } from '@/lib/utils';

interface Props {
  readonly monthlyIncome: SnapshotMonthlyIncome;
  readonly anticipated: SnapshotAnticipated;
}

function FlowRow({
  label,
  actual,
  expected,
  actualClass,
  indent,
  separator,
}: {
  readonly label: string;
  readonly actual: number;
  readonly expected: number | null;
  readonly actualClass?: string;
  readonly indent?: boolean;
  readonly separator?: boolean;
}) {
  return (
    <tr
      className={
        separator
          ? 'border-t-2 border-border-base'
          : 'border-t border-border-subtle'
      }
    >
      <td
        className={`px-4 py-3 text-sm text-content-secondary ${indent ? 'pl-8' : ''}`}
      >
        {label}
      </td>
      <td
        className={`px-4 py-3 text-sm font-mono font-medium text-right ${actualClass ?? 'text-content-primary'}`}
      >
        {fmt(actual)}
      </td>
      <td className="px-4 py-3 text-sm font-mono font-medium text-right text-content-muted">
        {expected !== null ? fmt(expected) : '—'}
      </td>
    </tr>
  );
}

export function IncomeFlowCard({ monthlyIncome, anticipated }: Props) {
  const { income, actualInvestments, spendingIncome, needs, wants } =
    monthlyIncome;
  const hasExpected = anticipated.hasEntries;

  // expectedInvestments is derived: expected income minus expected spending income.
  const expectedInvestments = hasExpected
    ? anticipated.expectedIncome - anticipated.expectedSpendingIncome.total
    : null;

  // Allocation is not configured when income is flowing but needs/wants are
  // both zero (the service sets them to zero when percentages are null).
  const allocationNotConfigured = spendingIncome > 0 && needs === 0 && wants === 0;

  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="px-6 py-4 border-b border-border-base">
        <h2 className="text-lg font-semibold text-content-primary">
          Income Flow
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="bg-surface-subtle">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-content-secondary uppercase tracking-wider w-2/5" />
              <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                Actual
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                {hasExpected ? 'Expected' : '—'}
              </th>
            </tr>
          </thead>
          <tbody>
            <FlowRow
              label="Gross Income"
              actual={income}
              expected={hasExpected ? anticipated.expectedIncome : null}
              actualClass="text-positive"
            />
            <FlowRow
              label="Less: Investments"
              actual={actualInvestments}
              expected={expectedInvestments}
              actualClass="text-content-muted"
            />
            <FlowRow
              label="Spending Income"
              actual={spendingIncome}
              expected={
                hasExpected ? anticipated.expectedSpendingIncome.total : null
              }
              separator
            />
            {!allocationNotConfigured && (
              <>
                <FlowRow
                  label="Needs"
                  actual={needs}
                  expected={
                    hasExpected
                      ? anticipated.expectedSpendingIncome.needs
                      : null
                  }
                  indent
                />
                <FlowRow
                  label="Wants"
                  actual={wants}
                  expected={
                    hasExpected
                      ? anticipated.expectedSpendingIncome.wants
                      : null
                  }
                  indent
                />
              </>
            )}
          </tbody>
        </table>
      </div>
      {allocationNotConfigured && (
        <p className="px-6 py-3 text-xs text-content-muted border-t border-border-subtle">
          Allocation percentages not configured.{' '}
          <Link to="/config" className="text-info underline">
            Set them in Settings
          </Link>{' '}
          to see Needs/Wants breakdown.
        </p>
      )}
    </div>
  );
}
