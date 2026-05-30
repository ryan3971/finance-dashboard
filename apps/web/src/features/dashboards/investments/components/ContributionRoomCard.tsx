import { cn } from '@/lib/utils';
import { SectionHelp } from '@/components/common/SectionHelp';
import type { ContributionRoomResponse } from '@finance/shared/types/investments';
import { ContributionRoomRow } from './ContributionRoomRow';

function PencilIcon() {
  return (
    <svg
      className="inline w-3 h-3 ml-1 text-content-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

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
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
        <h2 className="text-sm font-medium text-content-primary">Contribution Room</h2>
        <SectionHelp contentKey="investments.contributionRoom" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-surface-subtle">
            <tr>
              <th className="th-cell">Account</th>
              <th className="th-cell">Type</th>
              <th className="th-cell text-right">Contributed</th>
              <th className="th-cell text-right">Withdrawn</th>
              <th className="th-cell text-right">Annual Limit<PencilIcon /></th>
              <th className="th-cell text-right">Room Carried<PencilIcon /></th>
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
