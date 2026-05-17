import type { RebalancingGroup } from '@finance/shared/types/rebalancing';

interface RebalancingStatsBarProps {
  groups: RebalancingGroup[];
}

export function RebalancingStatsBar({ groups }: RebalancingStatsBarProps) {
  const { open, flagged, resolved } = groups.reduce(
    (acc, g) => {
      if (g.status === 'open') acc.open++;
      if (g.flaggedForReview) acc.flagged++;
      if (g.status === 'resolved') acc.resolved++;
      return acc;
    },
    { open: 0, flagged: 0, resolved: 0 },
  );

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
