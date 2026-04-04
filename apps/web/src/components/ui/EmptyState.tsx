interface EmptyStateProps {
  message: string;
  hint?: string;
  variant?: 'default' | 'error';
}

export function EmptyState({
  message,
  hint,
  variant = 'default',
}: EmptyStateProps) {
  const textClass =
    variant === 'error' ? 'text-danger' : 'text-content-muted';

  return (
    <div className="text-center py-12">
      <p className={textClass}>{message}</p>
      {hint && <p className="text-sm text-content-muted mt-1">{hint}</p>}
    </div>
  );
}
