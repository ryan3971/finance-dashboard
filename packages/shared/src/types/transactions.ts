// This is imported in /db/schema.ts, so be careful in making changes here
export const NEED_WANT_OPTIONS = ['Need', 'Want', 'NA'] as const;
export type NeedWant = (typeof NEED_WANT_OPTIONS)[number];

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
