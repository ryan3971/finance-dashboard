// Test anticipated-budget set — minimal and frozen.
//
// Five entries cover every branch the service can reach:
//
//   Rent            (expense, Need,  no category,  flat $1500/mo, no overrides)
//                   → all 12 months resolve to 1500, isOverride: false
//
//   Groceries Budget (expense, Need,  Groceries,    $400/mo + June override $500)
//                   → exercises the mixed path: 11 months at default, 1 at override
//
//   Car Insurance   (expense, Need,  no category,  monthlyAmount null, 2 overrides)
//                   → irregular entry: months without an override resolve to 0
//
//   Paycheque       (income,         Income,        $4000/mo, no overrides)
//                   → isIncome true requires needWant null (DB check constraint)
//
//   Dining Out      (expense, Want,  Dining,        $200/mo, no overrides)
//                   → Want classification, category-linked, no overrides
//
// Category names match TEST_CATEGORIES.  The seeder resolves them to IDs at
// insert time so this file stays independent of auto-generated UUIDs.
//
// Month overrides are in TEST_ANTICIPATED_BUDGET_MONTHS, keyed by entryName.

import type { NeedWant } from '@finance/shared/constants';

export interface TestAnticipatedBudgetEntry {
  name: string;
  // Category parent name from TEST_CATEGORIES, or null
  category: string | null;
  needWant: NeedWant | null;
  isIncome: boolean;
  monthlyAmount: string | null;
  notes: string | null;
  effectiveYear: number;
}

export interface TestAnticipatedBudgetMonthOverride {
  // Matches the entry by TestAnticipatedBudgetEntry.name
  entryName: string;
  month: number;
  amount: string;
}

export const TEST_ANTICIPATED_BUDGET: TestAnticipatedBudgetEntry[] = [
  // Flat entry — uniform amount every month, no overrides
  {
    name: 'Rent',
    category: null,
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: '1500.00',
    notes: null,
    effectiveYear: 2026,
  },
  // Override entry — default amount with one month overridden
  {
    name: 'Groceries Budget',
    category: 'Groceries',
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: '400.00',
    notes: null,
    effectiveYear: 2026,
  },
  // Irregular entry — no default amount; only override months contribute a value
  {
    name: 'Car Insurance',
    category: null,
    needWant: 'Need',
    isIncome: false,
    monthlyAmount: null,
    notes: null,
    effectiveYear: 2026,
  },
  // Income entry — needWant must be null when isIncome is true
  {
    name: 'Paycheque',
    category: 'Income',
    needWant: null,
    isIncome: true,
    monthlyAmount: '4000.00',
    notes: null,
    effectiveYear: 2026,
  },
  // Want entry — category-linked, flat amount, no overrides
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

export const TEST_ANTICIPATED_BUDGET_MONTHS: TestAnticipatedBudgetMonthOverride[] =
  [
    // Groceries Budget: June bumped up — exercises the mixed-override path
    { entryName: 'Groceries Budget', month: 6, amount: '500.00' },
    // Car Insurance: paid bi-annually in March and September
    { entryName: 'Car Insurance', month: 3, amount: '900.00' },
    { entryName: 'Car Insurance', month: 9, amount: '900.00' },
  ];
