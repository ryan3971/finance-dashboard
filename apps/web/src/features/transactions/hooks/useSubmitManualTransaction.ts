import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CreateTransactionInput } from '@finance/shared';
import { useCreateTransaction } from '@/features/transactions/hooks/useTransactionMutations';
import { transactionKeys } from '@/lib/queryKeys';
import { TOAST } from '@/lib/toastMessages';

export function useSubmitManualTransaction() {
  const queryClient = useQueryClient();
  const createTransaction = useCreateTransaction();
  const [serverError, setServerError] = useState('');
  const [isAttachingTags, setIsAttachingTags] = useState(false);

  async function submit(
    values: CreateTransactionInput,
    tagIds: Set<string>
  ): Promise<boolean> {
    setServerError('');
    const tx = await createTransaction.mutateAsync(values);

    if (tagIds.size === 0) return true;

    setIsAttachingTags(true);
    try {
      await Promise.all(
        Array.from(tagIds).map((tagId) =>
          api.post(`/transactions/${tx.id}/tags`, { tagId })
        )
      );
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all() });
    } catch {
      setServerError(TOAST.TRANSACTION_TAG_ATTACH_FAILED);
      return false;
    } finally {
      setIsAttachingTags(false);
    }

    return true;
  }

  return {
    submit,
    serverError,
    isSubmitting: createTransaction.isPending || isAttachingTags,
  };
}
