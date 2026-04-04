type Variant = 'warning' | 'info' | 'accent' | 'success' | 'neutral';
type Rounded = 'sm' | 'full';

const variantClasses: Record<Variant, string> = {
  warning: 'bg-warning-subtle text-warning border border-warning-border',
  info: 'bg-info-subtle text-info',
  accent: 'bg-accent-bg text-accent',
  success: 'bg-positive-bg text-positive',
  neutral: 'bg-surface-muted text-content-secondary',
};

interface BadgeProps {
  variant: Variant;
  rounded?: Rounded;
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant,
  rounded = 'sm',
  children,
  className = '',
}: BadgeProps) {
  const roundedClass = rounded === 'full' ? 'rounded-full' : 'rounded';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${roundedClass} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
