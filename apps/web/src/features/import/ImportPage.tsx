import { useRef, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
import { getApiErrorMessage } from '@/lib/errors';
import type { ImportResult } from '@finance/shared';
import { PageLayout } from '@/components/layout/PageLayout';
import { Select } from '@/components/ui/Select';
import { transactionKeys } from '@/lib/queryKeys';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { useQueryClient } from '@tanstack/react-query';

export function ImportPage() {
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const queryClient = useQueryClient();

  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !accountId) return;

    setLoading(true);
    setResult(null);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId);

    try {
      const { data } = await api.post<ImportResult>(
        '/imports/upload',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Import failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setResult(null);
    setError('');
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError('');
    setAccountId('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <PageLayout>
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold text-content-primary mb-6">
          Import transactions
        </h1>

        <div className="bg-surface rounded-lg border border-border-base p-6">
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="space-y-4"
          >
            <FormField label="Account">
              {accountsLoading ? (
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
              {loading ? 'Importing...' : 'Import'}
            </Button>
          </form>
        </div>

        {result && (
          <div className="mt-4 bg-surface rounded-lg border border-border-base p-6">
            <h2 className="text-sm font-medium text-content-primary mb-3">
              Import complete
            </h2>
            <dl className="space-y-1.5">
              <ResultRow
                label="Imported"
                value={result.importedCount}
                highlight="green"
              />
              <ResultRow
                label="Duplicates skipped"
                value={result.duplicateCount}
              />
              <ResultRow
                label="Flagged for review"
                value={result.flaggedCount}
                highlight={result.flaggedCount > 0 ? 'yellow' : undefined}
              />
              <ResultRow
                label="Transfer candidates"
                value={result.transferCandidateCount}
                highlight={
                  result.transferCandidateCount > 0 ? 'blue' : undefined
                }
              />
              <ResultRow
                label="Errors"
                value={result.errorCount}
                highlight={result.errorCount > 0 ? 'red' : undefined}
              />
            </dl>
            {result.errors.length > 0 && (
              <div className="mt-3 text-xs text-danger space-y-0.5">
                {result.errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
            <button
              onClick={reset}
              className="mt-4 text-sm text-content-secondary hover:text-content-primary"
            >
              Import another file
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

function ResultRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: 'green' | 'yellow' | 'red' | 'blue';
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
