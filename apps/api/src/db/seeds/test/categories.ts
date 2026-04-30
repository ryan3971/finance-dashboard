// Test category set — minimal and frozen.
//
// Nine categories cover every branch the pipeline can reach with the
// current CSV fixtures:
//
//   Salary         (income)  — keyword 'prodigy educati'
//   Government     (income)  — keyword 'gst gst'
//   Food           (expense) — keywords 'walmart', 'tim hortons', 'lcbo'
//   Transport      (expense) — keyword 'presto'
//   Subscriptions  (expense) — keywords 'netflix', 'spotify'
//   Health         (expense) — keyword 'shoppers drug'
//   Shopping       (expense) — keyword 'amzn'
//   Transfer                 — keywords 'payment received', 'payment thank you'
//   Uncategorized            — required fallback; any unmatched description lands here

export interface TestCategory {
  name: string;
  isIncome: boolean;
  icon: string;
  subcategories: string[];
}

export const TEST_CATEGORIES: TestCategory[] = [
  {
    name: 'Salary',
    isIncome: true,
    icon: '💼',
    subcategories: ['Paycheque'],
  },
  {
    name: 'Government',
    isIncome: true,
    icon: '🏛️',
    subcategories: ['GST'],
  },
  {
    name: 'Food',
    isIncome: false,
    icon: '🍽️',
    subcategories: ['Groceries', 'Eating Out', 'Alcohol'],
  },
  {
    name: 'Transport',
    isIncome: false,
    icon: '🚌',
    subcategories: ['Transit'],
  },
  {
    name: 'Subscriptions',
    isIncome: false,
    icon: '📺',
    subcategories: ['Media'],
  },
  {
    name: 'Health',
    isIncome: false,
    icon: '💊',
    subcategories: ['Pharmacy'],
  },
  {
    name: 'Shopping',
    isIncome: false,
    icon: '🛍️',
    subcategories: ['Online Retail'],
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
