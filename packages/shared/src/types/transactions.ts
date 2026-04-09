import type { NeedWant } from '../constants';

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

export interface PatchTransactionInput {
  categoryId?: string | null;
  subcategoryId?: string | null;
  needWant?: NeedWant | null;
  note?: string | null;
  createRule?: boolean;
}
