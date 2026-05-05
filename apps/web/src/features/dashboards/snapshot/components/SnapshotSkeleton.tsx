import { Skeleton } from '@/components/ui/Skeleton';

export function SnapshotSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="p-6 space-y-4 bg-surface rounded-lg border border-border-base">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={`inc-${i}`} className="h-8 w-full" />
          ))}
        </div>
        <div className="p-6 space-y-4 bg-surface rounded-lg border border-border-base">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={`acct-${i}`} className="h-10 w-full" />
          ))}
        </div>
      </div>
      <div className="p-6 space-y-4 bg-surface rounded-lg border border-border-base">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={`spend-${i}`} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
