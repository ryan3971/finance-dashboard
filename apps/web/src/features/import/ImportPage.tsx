import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
import { PageLayout } from '@/components/layout/PageLayout';
import { Select } from '@/components/ui/Select';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { ImportResultCard } from './components/ImportResultCard';
import { useImportUpload } from './hooks/useImportUpload';

export function ImportPage() {
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const {
    accountId,
    setAccountId,
    file,
    loading,
    result,
    error,
    fileInputRef,
    handleSubmit,
    handleFileChange,
    reset,
  } = useImportUpload();

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

        {result && <ImportResultCard result={result} onReset={reset} />}
      </div>
    </PageLayout>
  );
}
