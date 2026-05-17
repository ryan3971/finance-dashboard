import { fmt } from '@/lib/utils';
import type { InvestmentSummaryResponse } from '@finance/shared/types/investments';

interface CardProps {
  readonly label: string;
  readonly value: number;
  readonly colorClass: string;
}

function SummaryCard({ label, value, colorClass }: CardProps) {
  return (
    <div className="bg-surface rounded-lg border border-border-base p-6">
      <p className="text-sm font-medium text-content-secondary mb-1">{label}</p>
      <p className={`text-xl font-semibold font-mono ${colorClass}`}>{fmt(value)}</p>
    </div>
  );
}

interface Props {
  readonly data: InvestmentSummaryResponse;
}

export function ActivitySummaryCards({ data }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <SummaryCard
        label="Dividends Received"
        value={data.dividendsReceived}
        colorClass="text-positive"
      />
      <SummaryCard
        label="Fees Paid"
        value={data.feesPaid}
        colorClass="text-danger"
      />
      <SummaryCard
        label="Net Deposits"
        value={data.netDeposits}
        colorClass="text-content-primary"
      />
    </div>
  );
}
