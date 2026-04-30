import type { NeedWant } from '@finance/shared/constants';

export interface StagingAnticipatedBudgetEntry {
  name: string;
  category: string | null;
  needWant: NeedWant | null;
  isIncome: boolean;
  monthlyAmount: string | null;
  notes: string | null;
  effectiveYear: number;
}

export interface StagingAnticipatedBudgetMonthOverride {
  entryName: string;
  month: number;
  amount: string;
}

export const STAGING_ANTICIPATED_BUDGET: StagingAnticipatedBudgetEntry[] = [
  {
    name: 'Rent',
    category: null,
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: '1500.00',
    notes: null,
    effectiveYear: 2026,
  },
  {
    name: 'Groceries Budget',
    category: 'Groceries',
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: '400.00',
    notes: null,
    effectiveYear: 2026,
  },
  {
    name: 'Car Insurance',
    category: null,
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: null,
    notes: null,
    effectiveYear: 2026,
  },
  {
    name: 'Paycheque',
    category: 'Income',
    needWant: null,
    isIncome: true,
    monthlyAmount: '4000.00',
    notes: null,
    effectiveYear: 2026,
  },
  {
    name: 'Dining Out',
    category: 'Dining',
    needWant: 'Want',
    isIncome: false,
    monthlyAmount: '200.00',
    notes: null,
    effectiveYear: 2026,
  },
];

export const STAGING_ANTICIPATED_BUDGET_MONTHS: StagingAnticipatedBudgetMonthOverride[] =
  [
    { entryName: 'Groceries Budget', month: 6, amount: '500.00' },
    { entryName: 'Car Insurance', month: 3, amount: '900.00' },
    { entryName: 'Car Insurance', month: 9, amount: '900.00' },
  ];
