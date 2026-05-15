export interface RuleSuggestion {
  id: string;
  suggestedKeyword: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  needWant: 'Need' | 'Want' | 'NA' | null;
  confidence: number;
  transactionId: string | null;
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: string;
}

export interface AcceptSuggestionInput {
  keyword?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  needWant?: 'Need' | 'Want' | null;
  priority?: number;
  matchType?: 'substring' | 'wildcard';
}
