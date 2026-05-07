import type { NeedWant } from '@finance/shared/constants';

export interface StagingAnticipatedBudgetEntry {
  name: string;
  // Category name resolved against system categories at seed time.
  // Use a subcategory name (e.g. 'Groceries') for granular matching.
  category: string | null;
  needWant: NeedWant | null;
  isIncome: boolean;
  monthlyAmount: string | null;
  notes: string | null;
}

export interface StagingAnticipatedBudgetMonthOverride {
  entryName: string;
  month: number;
  amount: string;
}

export const STAGING_ANTICIPATED_BUDGET: StagingAnticipatedBudgetEntry[] = [
  // Income
  {
    name: 'Paycheque',
    category: 'Paycheque',
    needWant: null,
    isIncome: true,
    monthlyAmount: '4000.00',
    notes: null,
  },

  // Fixed needs
  {
    name: 'Rent',
    category: 'Rent',
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: '1500.00',
    notes: null,
  },
  {
    name: 'Internet',
    category: 'Internet',
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: '80.00',
    notes: null,
  },
  {
    name: 'Transit',
    category: 'Transit',
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: '100.00',
    notes: null,
  },

  // Variable needs
  {
    name: 'Groceries',
    category: 'Groceries',
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: '400.00',
    notes: null,
  },
  {
    name: 'Pharmacy',
    category: 'Pharmacy',
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: '60.00',
    notes: null,
  },

  // Irregular need — only applies in specific months
  {
    name: 'Car Insurance',
    category: 'Insurance',
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: null,
    notes: null,
  },

  // Wants
  {
    name: 'Dining Out',
    category: 'Eating Out',
    needWant: 'Want',
    isIncome: false,
    monthlyAmount: '200.00',
    notes: null,
  },
  {
    name: 'Streaming',
    category: 'Media',
    needWant: 'Want',
    isIncome: false,
    monthlyAmount: '50.00',
    notes: null,
  },
  {
    name: 'Online Shopping',
    category: 'Online Retail',
    needWant: 'Want',
    isIncome: false,
    monthlyAmount: '150.00',
    notes: null,
  },
];

export const STAGING_ANTICIPATED_BUDGET_MONTHS: StagingAnticipatedBudgetMonthOverride[] =
  [
    { entryName: 'Car Insurance', month: 3, amount: '900.00' },
    { entryName: 'Car Insurance', month: 9, amount: '900.00' },
  ];
