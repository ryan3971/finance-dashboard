import { cn } from '@/lib/utils';

export type StatusFilter = 'all' | 'flagged' | 'open' | 'resolved';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Flagged', value: 'flagged' },
  { label: 'Open', value: 'open' },
  { label: 'Resolved', value: 'resolved' },
];

interface RebalancingFilterBarProps {
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  labelSearch: string;
  onLabelSearch: (value: string) => void;
}

export function RebalancingFilterBar({
  statusFilter,
  onStatusChange,
  labelSearch,
  onLabelSearch,
}: RebalancingFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded border border-border-strong">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onStatusChange(tab.value)}
            className={cn(
              'border-r border-border-strong px-3 py-1 text-xs transition-colors last:border-r-0',
              statusFilter === tab.value
                ? 'bg-content-primary text-white'
                : 'text-content-secondary hover:bg-surface-subtle',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Search groups…"
        value={labelSearch}
        onChange={(e) => onLabelSearch(e.target.value)}
        className="input-base w-48"
      />
    </div>
  );
}
