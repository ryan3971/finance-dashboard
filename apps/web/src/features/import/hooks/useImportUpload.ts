import { useRef, useState } from 'react';
import type {
  ImportProgressEvent,
  ImportResult,
} from '@finance/shared/types/transactions';
import { transactionKeys } from '@/lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { config } from '@/lib/config';
import { STORAGE_KEYS } from '@/lib/storageKeys';

async function readResponseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? 'Import failed. Please try again.';
  } catch {
    return 'Import failed. Please try again.';
  }
}

export function useImportUpload() {
  const queryClient = useQueryClient();

  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<ImportProgressEvent | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !accountId) return;

    setLoading(true);
    setResult(null);
    setError('');
    setProgress(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId);

    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const response = await fetch(
        `${config.apiBaseUrl}/imports/upload/stream`,
        {
          method: 'POST',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );

      if (!response.ok || !response.body) {
        setError(await readResponseError(response));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;

          // Parse boundary cast: SSE data arrives as JSON text, typed via the
          // shared ImportProgressEvent discriminated union.
          const event = JSON.parse(line.slice(6)) as ImportProgressEvent;
          setProgress(event);

          if (event.stage === 'complete') {
            setResult(event.result);
            void queryClient.invalidateQueries({
              queryKey: transactionKeys.all(),
            });
          } else if (event.stage === 'error') {
            setError(event.message);
          }
        }
      }
    } catch {
      setError('Connection lost during import. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setResult(null);
    setError('');
    setProgress(null);
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError('');
    setProgress(null);
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
    progress,
    fileInputRef,
    handleSubmit,
    handleFileChange,
    reset,
  };
}
