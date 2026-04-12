import { useRef, useState } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/errors';
import type { ImportResult } from '@finance/shared/types/transactions';
import { transactionKeys } from '@/lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';

export function useImportUpload() {
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

  return {
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
  };
}