import { useRef, useState } from 'react';
import api from '../lib/api';
import { PageLayout } from '../components/PageLayout';
import { useAccounts } from '../hooks/useAccounts';
import { useQueryClient } from '@tanstack/react-query';

interface ImportResult {
  importId: string;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  flaggedCount: number;
  transferCandidateCount: number;
  errorCount: number;
  errors: string[];
}

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
      // Invalidate transactions so the list refreshes
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? 'Import failed. Please try again.';
      setError(message);
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
        <h1 className="text-xl font-semibold text-gray-900 mb-6">
          Import transactions
        </h1>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account
              </label>
              {accountsLoading ? (
                <p className="text-sm text-gray-400">Loading accounts...</p>
              ) : (
                <select
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Select an account</option>
                  {accounts?.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.institution.toUpperCase()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* File input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File (.csv or .xlsx)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                required
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              {file && (
                <p className="mt-1 text-xs text-gray-400">{file.name}</p>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || !file || !accountId}
              className="w-full py-2 px-4 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Importing...' : 'Import'}
            </button>
          </form>
        </div>

        {/* Result summary */}
        {result && (
          <div className="mt-4 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-900 mb-3">
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
              <div className="mt-3 text-xs text-red-600 space-y-0.5">
                {result.errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
            <button
              onClick={reset}
              className="mt-4 text-sm text-gray-500 hover:text-gray-900"
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
    green: 'text-green-700 font-medium',
    yellow: 'text-yellow-700 font-medium',
    red: 'text-red-700 font-medium',
    blue: 'text-blue-700 font-medium',
  };

  return (
    <div className="flex justify-between text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className={highlight ? colors[highlight] : 'text-gray-900'}>
        {value}
      </dd>
    </div>
  );
}
