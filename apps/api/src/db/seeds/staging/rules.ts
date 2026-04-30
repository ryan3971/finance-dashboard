import type { SeedRule } from '@/db/seeds/system/rules';

export const STAGING_RULES: SeedRule[] = [
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
