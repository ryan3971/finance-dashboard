import { Link } from '@tanstack/react-router';
import type { SnapshotAccountRow, SnapshotEmergencyFund } from '@finance/shared/types/dashboard';
import { fmt } from '@/lib/utils';

interface Props {
  readonly accounts: SnapshotAccountRow[];
  readonly emergencyFund: SnapshotEmergencyFund;
}

function balanceColor(balance: number, isCredit: boolean): string {
  if (balance === 0) return 'text-content-muted';
  const positiveColor = isCredit ? 'text-danger' : 'text-positive';
  const negativeColor = isCredit ? 'text-positive' : 'text-danger';
  return balance > 0 ? positiveColor : negativeColor;
}

export function AccountsCard({ accounts, emergencyFund }: Props) {
  const chequingIndex = accounts.findIndex((a) => a.type === 'chequing');

  return (
    <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
      <div className="px-6 py-4 border-b border-border-base">
        <h2 className="text-lg font-semibold text-content-primary">Accounts</h2>
      </div>
      <ul className="divide-y divide-border-subtle">
        {accounts.length === 0 && (
          <li className="px-6 py-8 text-center text-sm text-content-muted">
            No active accounts.
          </li>
        )}
        {accounts.map((account, i) => (
          <li key={account.id}>
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm font-medium text-content-primary">{account.name}</p>
                <p className="text-xs text-content-muted capitalize">
                  {account.institution} · {account.type}
                </p>
              </div>
              <span
                className={`font-mono text-sm font-medium ${balanceColor(account.balance, account.isCredit)}`}
              >
                {fmt(account.balance)}
              </span>
            </div>
            {i === chequingIndex && (
              <EmergencyFundSection emergencyFund={emergencyFund} balance={account.balance} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmergencyFundSection({
  emergencyFund,
  balance,
}: {
  readonly emergencyFund: SnapshotEmergencyFund;
  readonly balance: number;
}) {
  if (emergencyFund.target === null) {
    return (
      <div className="mx-6 mb-4 px-4 py-3 bg-surface-subtle rounded-md text-xs text-content-muted">
        Emergency fund target not set.{' '}
        <Link to="/config" className="text-info underline">
          Configure in Settings
        </Link>
        .
      </div>
    );
  }

  const pct = emergencyFund.percentage ?? 0;
  const fillPct = Math.min(pct, 100);
  const isFunded = pct >= 100;

  return (
    <div className="mx-6 mb-4 px-4 py-3 bg-surface-subtle rounded-md space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-content-secondary">
          Emergency Fund
        </span>
        <span
          className={`text-xs font-semibold font-mono ${isFunded ? 'text-positive' : 'text-content-secondary'}`}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isFunded ? 'bg-positive' : 'bg-info'}`}
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <p className="text-xs text-content-muted">
        {fmt(balance)} of {fmt(emergencyFund.target)} target
      </p>
    </div>
  );
}
