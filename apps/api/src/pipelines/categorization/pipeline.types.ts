export interface CategorizationResult {
  categoryId: string | null;
  subcategoryId: string | null;
  needWant: 'Need' | 'Want' | 'NA' | null;
  categorySource: 'rule' | 'ai' | 'manual' | 'default';
  categoryConfidence: number;
  sourceName: string | null;
  flaggedForReview: boolean;
}
