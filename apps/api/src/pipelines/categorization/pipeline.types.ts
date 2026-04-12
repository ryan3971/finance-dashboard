import type { NeedWant } from '@finance/shared/constants';

export interface CategorizationResult {
  categoryId: string | null;
  subcategoryId: string | null;
  needWant: NeedWant | null;
  categorySource: 'rule' | 'ai' | 'manual' | 'default';
  categoryConfidence: number;
  sourceName: string | null;
  flaggedForReview: boolean;
}
