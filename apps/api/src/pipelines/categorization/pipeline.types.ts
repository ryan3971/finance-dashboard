import type { NeedWant } from '@finance/shared/constants';
import type { CategorySource } from '@finance/shared/schemas/transactions';

export interface CategorizationResult {
  categoryId: string | null;
  subcategoryId: string | null;
  needWant: NeedWant | null;
  categorySource: CategorySource;
  categoryConfidence: number;
  sourceName: string | null;
  flaggedForReview: boolean;
}
