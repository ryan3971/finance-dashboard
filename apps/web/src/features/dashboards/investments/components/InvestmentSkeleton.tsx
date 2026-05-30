import { Skeleton } from '@/components/ui/Skeleton';

const SKELETON_ROWS = Array.from({ length: 7 }, (_, i) => `skeleton-${i}`);

export function InvestmentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }, (_, i) => `scard-${i}`).map((k) => (
          <div key={k} className="bg-surface rounded-lg border border-border-base p-6">
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="bg-surface rounded-lg border border-border-base overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-subtle border-b border-border-subtle" />
        {SKELETON_ROWS.map((k) => (
          <div key={k} className="px-4 py-3 border-t border-border-subtle flex gap-4 items-center">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
