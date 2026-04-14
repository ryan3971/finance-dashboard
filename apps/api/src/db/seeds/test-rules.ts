import type { SeedRule } from './rules';

// Test rule set — minimal and frozen.
//
// Designed so that payees in the existing CSV fixtures map predictably:
//
//   TD fixture
//     "E-TRANSFER OUT ***xxx"       → ADD sentinel (flagged, no category)
//     "PAYROLL DIRECT DEPOSIT"      → Income / Paycheque  (row added for this coverage)
//     Everything else               → Uncategorized (fallback)
//
//   AMEX fixture
//     "RESTAURANT HERO BISTRO …"    → Dining / Restaurant   (Want)
//     "PAYMENT RECEIVED - THANK YOU"→ Transfer / Credit Card Payment
//     Everything else               → Uncategorized (fallback)
//
//   CIBC fixture
//     "WAREHOUSE GROCERY CO …"      → Groceries / Supermarket  (Need)
//     "RESTAURANT HERO BISTRO …"    → Dining / Restaurant      (Want)
//     "PAYMENT THANK YOU/MERCI"     → Transfer / Credit Card Payment
//     Everything else               → Uncategorized (fallback)
//
// Priority 10 rules (ADD sentinel, transfers) run before priority 0 rules so
// that a transfer keyword always wins over any merchant keyword.

export const TEST_RULES: SeedRule[] = [
  // ADD sentinel — flag for review, assign no category
  {
    keyword: 'e-transfer',
    sourceName: 'E-Transfer',
    category: null,
    subcategory: null,
    needWant: 'ADD',
    priority: 10,
  },
  // Transfer payments
  {
    keyword: 'payment received',
    sourceName: 'Payment',
    category: 'Transfer',
    subcategory: 'Credit Card Payment',
    needWant: 'NA',
    priority: 10,
  },
  {
    keyword: 'payment thank you',
    sourceName: 'Payment',
    category: 'Transfer',
    subcategory: 'Credit Card Payment',
    needWant: 'NA',
    priority: 10,
  },
  // Income
  {
    keyword: 'direct deposit',
    sourceName: 'Payroll',
    category: 'Income',
    subcategory: 'Paycheque',
    needWant: 'NA',
    priority: 0,
  },
  // Need expense
  {
    keyword: 'grocery co',
    sourceName: 'Grocery Store',
    category: 'Groceries',
    subcategory: 'Supermarket',
    needWant: 'Need',
    priority: 0,
  },
  // Want expense
  {
    keyword: 'restaurant hero',
    sourceName: 'Restaurant Hero',
    category: 'Dining',
    subcategory: 'Restaurant',
    needWant: 'Want',
    priority: 0,
  },
];
