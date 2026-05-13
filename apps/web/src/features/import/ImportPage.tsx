import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionHelp } from '@/components/common/SectionHelp';
import { Select } from '@/components/ui/Select';
import { useAccounts } from '@/hooks/useAccounts';
import { ImportResultCard } from './components/ImportResultCard';
import { useImportUpload } from './hooks/useImportUpload';
import type { ImportProgressEvent } from '@finance/shared/types/transactions';

const STAGE_LABELS: Partial<Record<ImportProgressEvent['stage'], string>> = {
  parsing: 'Reading file…',
  categorizing: 'Categorizing transactions…',
  detecting_transfers: 'Detecting transfers…',
};

const METHOD_LABELS: Record<'rule' | 'ai' | 'fallback', string> = {
  rule: 'Rule matched',
  ai: 'AI categorized',
  fallback: 'Uncategorized',
};

export function ImportPage() {
  const { data: accounts, isPending: accountsPending } = useAccounts();
  const {
    accountId,
    setAccountId,
    file,
    loading,
    result,
    error,
    progress,
    fileInputRef,
    handleSubmit,
    handleFileChange,
    reset,
  } = useImportUpload();

  const pct =
    progress?.stage === 'categorizing' && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : null;

  const showForm = !loading && result === null;
  const showSpinner = loading && progress === null;
  const showProgress =
    loading &&
    progress !== null &&
    progress.stage !== 'complete' &&
    progress.stage !== 'error';

  return (
    <PageLayout>
      <div className="max-w-lg">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-xl font-semibold text-content-primary">
            Import transactions
          </h1>
          <SectionHelp contentKey="import.page" />
        </div>

        {showForm && (
          <div className="bg-surface rounded-lg border border-border-base p-6">
            <form
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              className="space-y-4"
            >
              <FormField label="Account">
                {accountsPending ? (
                  <p className="text-sm text-content-muted">
                    Loading accounts...
                  </p>
                ) : (
                  <Select
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full"
                  >
                    <option value="">Select an account</option>
                    {accounts?.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.institution.toUpperCase()})
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>

              <FormField label="File (.csv)">
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  accept=".csv"
                  onChange={handleFileChange}
                  className="w-full text-sm text-content-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-surface-muted file:text-gray-700 hover:file:bg-gray-200"
                />
                {file && (
                  <p className="mt-1 text-xs text-content-muted">{file.name}</p>
                )}
              </FormField>

              {error && <p className="text-sm text-danger">{error}</p>}

              <Button
                type="submit"
                disabled={loading || !file || !accountId}
                className="w-full py-2"
              >
                Import
              </Button>
            </form>
          </div>
        )}

        {showSpinner && (
          <div className="bg-surface rounded-lg border border-border-base p-6">
            <p className="text-sm text-content-muted">Uploading file…</p>
          </div>
        )}

        {showProgress && progress !== null && (
          <div className="bg-surface rounded-lg border border-border-base p-6 space-y-4">
            <p className="text-sm font-medium text-content-primary">
              {STAGE_LABELS[progress.stage] ?? '…'}
            </p>

            {progress.stage === 'categorizing' && (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-content-muted">
                    <span>
                      {progress.processed} / {progress.total}
                    </span>
                    <span>{METHOD_LABELS[progress.method]}</span>
                  </div>
                  <div className="w-full bg-surface-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-content-primary h-2 rounded-full transition-all duration-150"
                      style={{ width: `${pct ?? 0}%` }}
                    />
                  </div>
                </div>

                <dl className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <dt className="text-xs text-content-muted">Imported</dt>
                    <dd className="text-sm font-medium text-positive">
                      {progress.importedCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-content-muted">Flagged</dt>
                    <dd className="text-sm font-medium text-warning">
                      {progress.flaggedCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-content-muted">Duplicates</dt>
                    <dd className="text-sm font-medium text-content-secondary">
                      {progress.duplicateCount}
                    </dd>
                  </div>
                </dl>
              </>
            )}

            {progress.stage === 'parsing' && (
              <p className="text-xs text-content-muted">
                {progress.rowCount} rows &middot;{' '}
                {progress.institution.toUpperCase()}
              </p>
            )}
          </div>
        )}

        {error && !showForm && (
          <div className="mt-4">
            <p className="text-sm text-danger">{error}</p>
            <button
              onClick={reset}
              className="mt-2 text-sm text-content-secondary hover:text-content-primary"
            >
              Try again
            </button>
          </div>
        )}

        {result && <ImportResultCard result={result} onReset={reset} />}
      </div>
    </PageLayout>
  );
}
