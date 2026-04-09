import type { ImportResult } from '@finance/shared';

interface Props {
  readonly result: ImportResult;
  readonly onReset: () => void;
}

export function ImportResultCard({ result, onReset }: Props) {
  return (
    <div className="mt-4 bg-surface rounded-lg border border-border-base p-6">
      <h2 className="text-sm font-medium text-content-primary mb-3">
        Import complete
      </h2>
      <dl className="space-y-1.5">
        <ResultRow label="Imported" value={result.importedCount} highlight="green" />
        <ResultRow label="Duplicates skipped" value={result.duplicateCount} />
        <ResultRow
          label="Flagged for review"
          value={result.flaggedCount}
          highlight={result.flaggedCount > 0 ? 'yellow' : undefined}
        />
        <ResultRow
          label="Transfer candidates"
          value={result.transferCandidateCount}
          highlight={result.transferCandidateCount > 0 ? 'blue' : undefined}
        />
        <ResultRow
          label="Errors"
          value={result.errorCount}
          highlight={result.errorCount > 0 ? 'red' : undefined}
        />
      </dl>
      {result.errors.length > 0 && (
        <div className="mt-3 text-xs text-danger space-y-0.5">
          {result.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
      <button
        onClick={onReset}
        className="mt-4 text-sm text-content-secondary hover:text-content-primary"
      >
        Import another file
      </button>
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight,
}: {
  readonly label: string;
  readonly value: number;
  readonly highlight?: 'green' | 'yellow' | 'red' | 'blue';
}) {
  const colors = {
    green: 'text-positive font-medium',
    yellow: 'text-warning font-medium',
    red: 'text-danger font-medium',
    blue: 'text-info font-medium',
  };

  return (
    <div className="flex justify-between text-sm">
      <dt className="text-content-secondary">{label}</dt>
      <dd className={highlight ? colors[highlight] : 'text-content-primary'}>
        {value}
      </dd>
    </div>
  );
}
