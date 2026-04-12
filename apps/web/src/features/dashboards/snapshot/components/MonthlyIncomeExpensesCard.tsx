import { Link } from '@tanstack/react-router';
import type { SnapshotColumnValues, SnapshotMonthlyIncome } from '@finance/shared/types/dashboard';
import { fmt } from '@/lib/utils';

interface Props {
  monthlyIncome: SnapshotMonthlyIncome;
  monthlyExpenses: SnapshotColumnValues;
}

function AmountCell({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-sm font-mono font-medium text-right ${className ?? ''}`}>
      {fmt(value)}
    </td>
  );
}

export function MonthlyIncomeExpensesCard({ monthlyIncome, monthlyExpenses }: Props) {
  const { income, incomeLessInvestment: ili } = monthlyIncome;
  const allocationConfigured = ili.total > 0 || income === 0;

  const netTotal = ili.total - monthlyExpenses.total;
  const netNeeds = ili.needs - monthlyExpenses.needs;
  const netWants = ili.wants - monthlyExpenses.wants;

  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="px-6 py-4 border-b border-border-base">
        <h2 className="text-lg font-semibold text-content-primary">Monthly Income &amp; Expenses</h2>
      </div>
      <table className="w-full text-left">
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
          {/* Income row */}
          <tr className="border-t border-border-subtle">
            <td className="px-4 py-3 text-sm font-medium text-content-primary">Income</td>
            <AmountCell value={income} className="text-positive" />
            <AmountCell value={ili.wants} className="text-positive" />
            <AmountCell value={ili.needs} className="text-positive" />
          </tr>
          {/* Less Investment — subordinate, muted */}
          <tr className="border-t border-border-subtle bg-surface-subtle">
            <td className="px-4 py-2 text-xs text-content-muted pl-8">Less Investment</td>
            <td className="px-4 py-2 text-xs font-mono text-right text-content-muted">
              {fmt(ili.total)}
            </td>
            <td className="px-4 py-2 text-xs font-mono text-right text-content-muted">
              {fmt(ili.wants)}
            </td>
            <td className="px-4 py-2 text-xs font-mono text-right text-content-muted">
              {fmt(ili.needs)}
            </td>
          </tr>
          {/* Expenses row */}
          <tr className="border-t border-border-subtle">
            <td className="px-4 py-3 text-sm font-medium text-content-primary">Expenses</td>
            <AmountCell value={monthlyExpenses.total} className="text-danger" />
            <AmountCell value={monthlyExpenses.wants} className="text-danger" />
            <AmountCell value={monthlyExpenses.needs} className="text-danger" />
          </tr>
          {/* Net Income — client-derived */}
          <tr className="border-t border-border-subtle">
            <td className="px-4 py-3 text-sm font-medium text-content-primary">Net Income</td>
            <AmountCell
              value={netTotal}
              className={netTotal >= 0 ? 'text-positive' : 'text-danger'}
            />
            <AmountCell
              value={netWants}
              className={netWants >= 0 ? 'text-positive' : 'text-danger'}
            />
            <AmountCell
              value={netNeeds}
              className={netNeeds >= 0 ? 'text-positive' : 'text-danger'}
            />
          </tr>
        </tbody>
      </table>
      {!allocationConfigured && income > 0 && (
        <p className="px-6 py-3 text-xs text-content-muted border-t border-border-subtle">
          Allocation percentages not configured.{' '}
          <Link to="/config" className="text-info underline">
            Set them in Settings
          </Link>{' '}
          to see Needs/Wants breakdowns.
        </p>
      )}
    </div>
  );
}
