import { cn } from '@/lib/utils';

type NeedWant = 'Need' | 'Want';

const OPTIONS: NeedWant[] = ['Need', 'Want'];

interface Props {
  readonly value: NeedWant | 'NA' | null;
  readonly onChange: (value: NeedWant | null) => void;
  readonly disabled?: boolean;
}

function toggleClass(active: boolean) {
  return cn(
    'px-3 py-1 text-xs rounded border transition-colors',
    active
      ? 'bg-content-primary text-white border-content-primary'
      : 'border-border-strong text-content-secondary hover:bg-surface-subtle',
  );
}

export function NeedWantToggle({ value, onChange, disabled }: Props) {
  const isUnset = value === null || value === 'NA';

  return (
    <div className="flex gap-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={toggleClass(value === opt)}
        >
          {opt}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(null)}
        className={toggleClass(isUnset)}
      >
        Unset
      </button>
    </div>
  );
}
