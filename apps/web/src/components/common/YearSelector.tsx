interface Props {
  readonly year: number;
  readonly onChange: (year: number) => void;
}

export function YearSelector({ year, onChange }: Props) {
  return (
    <div className="flex items-center gap-1">
      <button
        className="text-content-muted hover:text-content-primary transition-colors px-1"
        onClick={() => onChange(year - 1)}
        aria-label="Previous year"
      >
        ‹
      </button>
      <span className="text-sm font-medium text-content-primary w-12 text-center">
        {year}
      </span>
      <button
        className="text-content-muted hover:text-content-primary transition-colors px-1"
        onClick={() => onChange(year + 1)}
        aria-label="Next year"
      >
        ›
      </button>
    </div>
  );
}
