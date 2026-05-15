import { cn } from '@/lib/utils';

interface SegmentedControlOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SegmentedControlProps<T extends string> {
  readonly options: readonly SegmentedControlOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('flex gap-1 mt-1', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 text-xs rounded border transition-colors',
            value === opt.value
              ? 'bg-content-primary text-white border-content-primary'
              : 'border-border-strong text-content-secondary hover:bg-surface-subtle'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
