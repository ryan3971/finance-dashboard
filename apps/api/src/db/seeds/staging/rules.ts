import type { SeedRule } from '@/db/seeds/system/rules';

export const STAGING_RULES: SeedRule[] = [
  // ── Transfers (high priority) ─────────────────────────────────────────────
  // These keywords appear on the chequing side of credit card bill payments.
  // The credit card side is covered by the system 'payment received' / 'payment thank you' rules.
  {
    keyword: 'bill payment',
    sourceName: 'Bill Payment',
    category: 'Transfer',
    subcategory: 'Credit Card Payment',
    needWant: null,
    priority: 10,
  },

  // ── Income ────────────────────────────────────────────────────────────────
  {
    keyword: 'employer direct deposit',
    sourceName: 'Employer',
    category: 'Salary',
    subcategory: 'Paycheque',
    needWant: null,
    priority: 5,
  },
  {
    keyword: 'gst/hst',
    sourceName: 'Government',
    category: 'Government',
    subcategory: 'GST Credit',
    needWant: null,
    priority: 5,
  },

  // ── Need expenses ─────────────────────────────────────────────────────────
  {
    keyword: 'rent payment',
    sourceName: 'Rent',
    category: 'Housing',
    subcategory: 'Rent',
    needWant: 'Need',
    priority: 0,
  },
  {
    keyword: 'transit pass',
    sourceName: 'Transit',
    category: 'Transport',
    subcategory: 'Transit',
    needWant: 'Need',
    priority: 0,
  },
  {
    keyword: 'grocery',
    sourceName: 'Grocery Store',
    category: 'Food',
    subcategory: 'Groceries',
    needWant: 'Need',
    priority: 0,
  },
  {
    keyword: 'pharmacy',
    sourceName: 'Pharmacy',
    category: 'Health',
    subcategory: 'Pharmacy',
    needWant: 'Need',
    priority: 0,
  },

  // ── Want expenses ─────────────────────────────────────────────────────────
  {
    keyword: 'online retailer',
    sourceName: 'Online Retailer',
    category: 'Shopping',
    subcategory: 'Online Retail',
    needWant: 'Want',
    priority: 0,
  },
  {
    keyword: 'stream plus',
    sourceName: 'Streaming Service',
    category: 'Subscriptions',
    subcategory: 'Media',
    needWant: 'Want',
    priority: 0,
  },
  {
    keyword: 'coffee shop',
    sourceName: 'Coffee Shop',
    category: 'Food',
    subcategory: 'Café',
    needWant: 'Want',
    priority: 0,
  },
  {
    keyword: 'restaurant',
    sourceName: 'Restaurant',
    category: 'Food',
    subcategory: 'Eating Out',
    needWant: 'Want',
    priority: 0,
  },
];
