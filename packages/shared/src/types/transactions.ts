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

export type PatchTransactionInput = z.infer<typeof patchTransactionSchema>;
