// Test category set — minimal and frozen.
//
// Five categories cover every branch the pipeline can reach:
//   Groceries  (expense, Need)   — matched by keyword 'grocery co'
//   Dining     (expense, Want)   — matched by keyword 'restaurant hero'
//   Income     (income)          — matched by keyword 'direct deposit'
//   Transfer   (expense)         — matched by keywords 'payment received' / 'payment thank you'
//   Uncategorized                — required fallback; reached by any unmatched description
//
// Every transaction description in the existing CSV fixtures that contains none
// of the test rule keywords falls through to Uncategorized, exercising the
// default fallback path without needing a dedicated "no-match" rule.

export interface TestCategory {
  name: string;
  isIncome: boolean;
  icon: string;
  subcategories: string[];
}

export const TEST_CATEGORIES: TestCategory[] = [
  {
    name: 'Groceries',
    isIncome: false,
    icon: '🛒',
    subcategories: ['Supermarket'],
  },
  {
    name: 'Dining',
    isIncome: false,
    icon: '🍽️',
    subcategories: ['Restaurant'],
  },
  {
    name: 'Income',
    isIncome: true,
    icon: '💰',
    subcategories: ['Paycheque'],
  },
  {
    name: 'Transfer',
    isIncome: false,
    icon: '↔️',
    subcategories: ['Credit Card Payment'],
  },
  {
    name: 'Uncategorized',
    isIncome: false,
    icon: '❓',
    subcategories: [],
  },
];
