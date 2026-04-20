import { Button } from '@/components/ui/Button';

interface PaginationProps {
  readonly page: number;
  readonly totalPages: number;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

export function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: PaginationProps) {
  return (
    <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between text-sm text-content-secondary">
      <Button
        variant="secondary"
        size="sm"
        onClick={onPrev}
        disabled={page === 1}
      >
        Previous
      </Button>
      <span>
        Page {page} of {totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={onNext}
        disabled={page === totalPages}
      >
        Next
      </Button>
    </div>
  );
}
