import { cn } from '@/lib/utils';
import type { ContributionRoomResponse } from '@finance/shared/types/investments';
import { ContributionRoomRow } from './ContributionRoomRow';

interface Props {
  readonly data: ContributionRoomResponse;
  readonly isFetching: boolean;
}

export function ContributionRoomCard({ data, isFetching }: Props) {
  if (data.accounts.length === 0) return null;

  return (
    <div
      className={cn(
        'bg-surface rounded-lg border border-border-base overflow-hidden transition-opacity duration-200',
        isFetching && 'opacity-50'
      )}
    >
      <div className="px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-medium text-content-primary">Contribution Room</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-surface-subtle">
            <tr>
              <th className="th-cell">Account</th>
              <th className="th-cell">Type</th>
              <th className="th-cell text-right">Contributed</th>
              <th className="th-cell text-right">Withdrawn</th>
              <th className="th-cell text-right">Annual Limit</th>
              <th className="th-cell text-right">Room Carried</th>
              <th className="th-cell text-right">Available</th>
              <th className="th-cell w-24" />
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((account) => (
              <ContributionRoomRow
                key={account.accountId}
                account={account}
                year={data.year}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
