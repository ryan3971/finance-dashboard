import type { SeedRule } from '../system/rules';

// Test rule set — minimal and frozen.
//
// Designed so that payees in the current CSV fixtures map predictably:
//
//   TD fixture
//     "E-TRANSFER OUT ***abc/zzz"       → ADD sentinel (flagged, no category)
//     "PRODIGY EDUCATION INC PAYRL"     → Salary / Paycheque    (income)
//     "GST GST TAX REFUND"              → Government / GST       (income)
//     "WALMART GROCERY STORE 321"       → Food / Groceries       (Need)
//     "PRESTO TOPUP"                    → Transport / Transit    (Need)
//     "TIM HORTONS #227"                → Food / Eating Out      (Want)
//     "CREDIT CARD PYMT MSP"            → Uncategorized (no rule)
//     "CORNER STORE 456"                → Uncategorized (no rule)
//
//   AMEX fixture
//     "PAYMENT RECEIVED - THANK YOU"    → Transfer / Credit Card Payment
//     "TIM HORTONS #412"                → Food / Eating Out      (Want)
//     "NETFLIX.COM SUBSCRIPTION"        → Subscriptions / Media  (Want)
//     "SHOPPERS DRUG MART 312"          → Health / Pharmacy      (Need)
//     "AMZN MKTP CA*123ABC"             → Shopping / Online Retail (Want)
//     "SUNRISE BOUTIQUE 99812"          → Uncategorized (no rule)
//
//   CIBC fixture
//     "PAYMENT THANK YOU/MERCI"         → Transfer / Credit Card Payment
//     "WALMART SUPERCENTRE 552 …"       → Food / Groceries       (Need)
//     "TIM HORTONS 3351 …"              → Food / Eating Out      (Want)
//     "LCBO #456 …"                     → Food / Alcohol         (Want)
//     "SPOTIFY CANADA"                  → Subscriptions / Media  (Want)
//     "HARDWARE SUPPLY 789 …"           → Uncategorized (no rule)
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
    keyword: 'prodigy educati',
    sourceName: 'Prodigy Education',
    category: 'Salary',
    subcategory: 'Paycheque',
    needWant: 'NA',
    priority: 5,
  },
  {
    keyword: 'gst gst',
    sourceName: 'Government',
    category: 'Government',
    subcategory: 'GST',
    needWant: 'NA',
    priority: 5,
  },
  // Need expenses
  {
    keyword: 'walmart',
    sourceName: 'Walmart',
    category: 'Food',
    subcategory: 'Groceries',
    needWant: 'Need',
    priority: 0,
  },
  {
    keyword: 'presto',
    sourceName: 'Presto',
    category: 'Transport',
    subcategory: 'Transit',
    needWant: 'Need',
    priority: 0,
  },
  {
    keyword: 'shoppers drug',
    sourceName: 'Shoppers Drug Mart',
    category: 'Health',
    subcategory: 'Pharmacy',
    needWant: 'Need',
    priority: 0,
  },
  // Want expenses
  {
    keyword: 'tim hortons',
    sourceName: 'Tim Hortons',
    category: 'Food',
    subcategory: 'Eating Out',
    needWant: 'Want',
    priority: 0,
  },
  {
    keyword: 'lcbo',
    sourceName: 'LCBO',
    category: 'Food',
    subcategory: 'Alcohol',
    needWant: 'Want',
    priority: 0,
  },
  {
    keyword: 'netflix',
    sourceName: 'Netflix',
    category: 'Subscriptions',
    subcategory: 'Media',
    needWant: 'Want',
    priority: 0,
  },
  {
    keyword: 'spotify',
    sourceName: 'Spotify',
    category: 'Subscriptions',
    subcategory: 'Media',
    needWant: 'Want',
    priority: 0,
  },
  {
    keyword: 'amzn',
    sourceName: 'Amazon',
    category: 'Shopping',
    subcategory: 'Online Retail',
    needWant: 'Want',
    priority: 0,
  },
];
