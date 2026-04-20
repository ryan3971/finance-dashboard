import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export function SkeletonTable({
  columns,
  rows,
  className,
}: {
  readonly columns: number;
  readonly rows: number;
  readonly className?: string;
}) {
  return (
    <div className={cn('bg-surface rounded-lg border border-border-base overflow-hidden', className)}>
      <div className="px-4 py-2.5 bg-surface-subtle border-b border-border-subtle" />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={`skeleton-${i}`}
          className="flex gap-4 px-4 py-3 border-t border-border-subtle"
        >
          <Skeleton className="h-4 w-8" />
          {Array.from({ length: columns - 1 }, (_, j) => (
            <Skeleton key={`skeleton-col-${j}`} className="h-4 w-20 ml-auto" />
          ))}
        </div>
      ))}
    </div>
  );
}
