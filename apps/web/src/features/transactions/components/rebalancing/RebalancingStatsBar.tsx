import type { RebalancingGroup } from '@finance/shared/types/rebalancing';

interface RebalancingStatsBarProps {
  groups: RebalancingGroup[];
}

export function RebalancingStatsBar({ groups }: RebalancingStatsBarProps) {
  const open = groups.filter((g) => g.status === 'open').length;
  const flagged = groups.filter((g) => g.flaggedForReview).length;
  const resolved = groups.filter((g) => g.status === 'resolved').length;

  return (
    <p className="text-xs text-content-secondary">
      <span className="font-medium text-content-primary">{open}</span> open
      {' · '}
      <span className={flagged > 0 ? 'font-medium text-warning' : 'font-medium text-content-primary'}>
        {flagged}
      </span>{' '}
      flagged
      {' · '}
      <span className="font-medium text-content-primary">{resolved}</span> resolved
    </p>
  );
}
