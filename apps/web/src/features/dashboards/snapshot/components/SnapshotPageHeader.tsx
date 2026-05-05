import { cn } from '@/lib/utils';
import { useMonthNavigation } from '../hooks/useMonthNavigation';

// ── Month navigator ───────────────────────────────────────────────────────────

export function MonthNavigator({
  year,
  month,
}: {
  readonly year: number;
  readonly month: number;
}) {
  const { isCurrentMonth, label, prev, next, goToToday } = useMonthNavigation(year, month);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={prev}
        className="p-1.5 rounded hover:bg-surface-muted text-content-secondary hover:text-content-primary transition-colors"
        aria-label="Previous month"
      >
        ‹
      </button>
      <span className="px-1 text-sm font-medium text-content-primary min-w-[130px] text-center">
        {label}
      </span>
      <button
        onClick={next}
        disabled={isCurrentMonth}
        className={cn(
          'p-1.5 rounded text-content-secondary transition-colors',
          isCurrentMonth
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-surface-muted hover:text-content-primary'
        )}
        aria-label="Next month"
      >
        ›
      </button>
      {!isCurrentMonth && (
        <button
          onClick={goToToday}
          className="text-xs text-info underline hover:no-underline ml-1"
        >
          Today
        </button>
      )}
    </div>
  );
}

// ── Last updated badge ────────────────────────────────────────────────────────

export function LastUpdatedBadge({
  lastUploadedAt,
}: {
  readonly lastUploadedAt: Date;
}) {
  const formatted = lastUploadedAt.toLocaleDateString('en-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return (
    <span className="text-xs font-medium text-content-secondary">
      Updated {formatted}
    </span>
  );
}
