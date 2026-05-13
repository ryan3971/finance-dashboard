import type { z } from 'zod';
import type { patchTransactionSchema } from '../schemas/transactions';

export interface ImportResult {
  importId: string;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  flaggedCount: number;
  errorCount: number;
  errors: string[];
  transferCandidateCount: number;
}

export type ImportProgressEvent =
  | { stage: 'parsing'; rowCount: number; institution: string }
  | {
      stage: 'categorizing';
      processed: number;
      total: number;
      importedCount: number;
      flaggedCount: number;
      duplicateCount: number;
      errorCount: number;
      method: 'rule' | 'ai' | 'fallback';
    }
  | { stage: 'detecting_transfers' }
  | { stage: 'complete'; result: ImportResult }
  | { stage: 'error'; message: string };

export type PatchTransactionInput = z.infer<typeof patchTransactionSchema>;
