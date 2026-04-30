export interface StagingCategory {
  name: string;
  isIncome: boolean;
  icon: string;
  subcategories: string[];
}

export const STAGING_CATEGORIES: StagingCategory[] = [
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
