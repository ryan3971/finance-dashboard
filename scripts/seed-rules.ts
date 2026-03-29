import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../apps/api/src/db/index';
import { categorizationRules, categories } from '../apps/api/src/db/schema';
import { eq, isNull, and } from 'drizzle-orm';

// ─── Rule definitions ─────────────────────────────────────────────────────────
// Format: { keyword, sourceName, category, subcategory, needWant, priority }
// keyword   — case-insensitive contains match against transaction description
// needWant  — 'Need' | 'Want' | 'NA' | 'ADD'
//             ADD = sentinel: flag for review without assigning a category
// priority  — higher wins when multiple rules match (default 0)

const RULES = [
  // ── Transfers & payments (ADD sentinel — always needs review) ─────────────
  { keyword: 'send e-tfr',          sourceName: 'E-Transfer',    category: null,        subcategory: null,                    needWant: 'ADD', priority: 10 },
  { keyword: 'e-transfer',          sourceName: 'E-Transfer',    category: null,        subcategory: null,                    needWant: 'ADD', priority: 10 },
  { keyword: 'tfr-to',              sourceName: 'Transfer',      category: 'Transfer',  subcategory: 'Credit Card Payment',   needWant: 'NA',  priority: 10 },
  { keyword: 'tfr-fr',              sourceName: 'Transfer',      category: 'Transfer',  subcategory: 'Personal Transfer',     needWant: 'NA',  priority: 10 },
  { keyword: 'payment thank you',   sourceName: 'Payment',       category: 'Transfer',  subcategory: 'Credit Card Payment',   needWant: 'NA',  priority: 10 },
  { keyword: 'paiement merci',      sourceName: 'Payment',       category: 'Transfer',  subcategory: 'Credit Card Payment',   needWant: 'NA',  priority: 10 },
  { keyword: 'payment received',    sourceName: 'Payment',       category: 'Transfer',  subcategory: 'Credit Card Payment',   needWant: 'NA',  priority: 10 },

  // ── Income ────────────────────────────────────────────────────────────────
  { keyword: 'prodigy educati',     sourceName: 'Prodigy Education', category: 'Salary',       subcategory: 'Paycheque',   needWant: 'NA',  priority: 5 },
  { keyword: 'mobile deposit',      sourceName: 'Mobile Deposit',    category: 'Other Income', subcategory: 'Misc',        needWant: 'NA',  priority: 5 },
  { keyword: 'gst gst',             sourceName: 'Government',        category: 'Government',   subcategory: 'GST',         needWant: 'NA',  priority: 5 },
  { keyword: 'acct bal rebate',     sourceName: 'Bank',              category: 'Finance',      subcategory: 'Bank Fees',   needWant: 'NA',  priority: 5 },
  { keyword: 'manulife',            sourceName: 'Manulife',          category: 'Government',   subcategory: 'Benefits',    needWant: 'NA',  priority: 5 },

  // ── Food: Groceries ───────────────────────────────────────────────────────
  { keyword: 'costco',              sourceName: 'Costco',            category: 'Food',      subcategory: 'Groceries',     needWant: 'Need', priority: 0 },
  { keyword: 'food basics',         sourceName: 'Food Basics',       category: 'Food',      subcategory: 'Groceries',     needWant: 'Need', priority: 0 },
  { keyword: 'fortinos',            sourceName: 'Fortinos',          category: 'Food',      subcategory: 'Groceries',     needWant: 'Need', priority: 0 },
  { keyword: 'loblaws',             sourceName: 'Loblaws',           category: 'Food',      subcategory: 'Groceries',     needWant: 'Need', priority: 0 },
  { keyword: 'metro',               sourceName: 'Metro',             category: 'Food',      subcategory: 'Groceries',     needWant: 'Need', priority: 0 },
  { keyword: 'no frills',           sourceName: 'No Frills',         category: 'Food',      subcategory: 'Groceries',     needWant: 'Need', priority: 0 },
  { keyword: 'sobeys',              sourceName: 'Sobeys',            category: 'Food',      subcategory: 'Groceries',     needWant: 'Need', priority: 0 },
  { keyword: 'walmart',             sourceName: 'Walmart',           category: 'Food',      subcategory: 'Groceries',     needWant: 'Need', priority: 0 },
  { keyword: 'whole foods',         sourceName: 'Whole Foods',       category: 'Food',      subcategory: 'Groceries',     needWant: 'Need', priority: 0 },
  { keyword: 'instacart',           sourceName: 'Instacart',         category: 'Food',      subcategory: 'Groceries',     needWant: 'Need', priority: 0 },
  { keyword: 'sp canadian protein', sourceName: 'Canadian Protein',  category: 'Health',    subcategory: 'Supplements',   needWant: 'Need', priority: 0 },

  // ── Food: Eating Out ──────────────────────────────────────────────────────
  { keyword: 'tim hortons',         sourceName: 'Tim Hortons',       category: 'Food',      subcategory: 'Eating Out',    needWant: 'Want', priority: 0 },
  { keyword: 'mcdonalds',           sourceName: "McDonald's",        category: 'Food',      subcategory: 'Eating Out',    needWant: 'Want', priority: 0 },
  { keyword: 'mcdonald',            sourceName: "McDonald's",        category: 'Food',      subcategory: 'Eating Out',    needWant: 'Want', priority: 0 },
  { keyword: 'starbucks',           sourceName: 'Starbucks',         category: 'Food',      subcategory: 'Coffee',        needWant: 'Want', priority: 0 },
  { keyword: 'subway',              sourceName: 'Subway',            category: 'Food',      subcategory: 'Eating Out',    needWant: 'Want', priority: 0 },
  { keyword: 'uber eats',           sourceName: 'Uber Eats',         category: 'Food',      subcategory: 'Delivery',      needWant: 'Want', priority: 0 },
  { keyword: 'skip the dishes',     sourceName: 'SkipTheDishes',     category: 'Food',      subcategory: 'Delivery',      needWant: 'Want', priority: 0 },
  { keyword: 'doordash',            sourceName: 'DoorDash',          category: 'Food',      subcategory: 'Delivery',      needWant: 'Want', priority: 0 },
  { keyword: 'dropout',             sourceName: 'Dropout',           category: 'Food',      subcategory: 'Eating Out',    needWant: 'Want', priority: 0 },
  { keyword: 'sunnyside grill',     sourceName: 'Sunnyside Grill',   category: 'Food',      subcategory: 'Eating Out',    needWant: 'Want', priority: 0 },
  { keyword: 'tavern on king',      sourceName: 'Tavern On King',    category: 'Food',      subcategory: 'Eating Out',    needWant: 'Want', priority: 0 },
  { keyword: 'lcbo',                sourceName: 'LCBO',              category: 'Food',      subcategory: 'Alcohol',       needWant: 'Want', priority: 0 },
  { keyword: 'beer store',          sourceName: 'Beer Store',        category: 'Food',      subcategory: 'Alcohol',       needWant: 'Want', priority: 0 },

  // ── Transport ─────────────────────────────────────────────────────────────
  { keyword: 'esso',                sourceName: 'Esso',              category: 'Transport', subcategory: 'Gas',           needWant: 'Need', priority: 0 },
  { keyword: 'petro',               sourceName: 'Petro-Canada',      category: 'Transport', subcategory: 'Gas',           needWant: 'Need', priority: 0 },
  { keyword: 'shell',               sourceName: 'Shell',             category: 'Transport', subcategory: 'Gas',           needWant: 'Need', priority: 0 },
  { keyword: 'spothero',            sourceName: 'SpotHero',          category: 'Transport', subcategory: 'Parking',       needWant: 'Want', priority: 0 },
  { keyword: 'impark',              sourceName: 'Impark',            category: 'Transport', subcategory: 'Parking',       needWant: 'Need', priority: 0 },
  { keyword: 'presto',              sourceName: 'Presto',            category: 'Transport', subcategory: 'Transit',       needWant: 'Need', priority: 0 },
  { keyword: 'uber',                sourceName: 'Uber',              category: 'Transport', subcategory: 'Rideshare',     needWant: 'Want', priority: 0 },
  { keyword: 'lyft',                sourceName: 'Lyft',              category: 'Transport', subcategory: 'Rideshare',     needWant: 'Want', priority: 0 },
  { keyword: 'newton esso',         sourceName: 'Esso',              category: 'Transport', subcategory: 'Gas',           needWant: 'Need', priority: 1 },

  // ── Shopping ──────────────────────────────────────────────────────────────
  { keyword: 'amazon',              sourceName: 'Amazon',            category: 'Shopping',  subcategory: 'Online Retail', needWant: 'Want', priority: 0 },
  { keyword: 'amzn',                sourceName: 'Amazon',            category: 'Shopping',  subcategory: 'Online Retail', needWant: 'Want', priority: 0 },
  { keyword: 'staples',             sourceName: 'Staples',           category: 'Shopping',  subcategory: 'Other',         needWant: 'Want', priority: 0 },
  { keyword: 'sportchek',           sourceName: 'Sport Chek',        category: 'Shopping',  subcategory: 'Clothing',      needWant: 'Want', priority: 0 },
  { keyword: 'sp ten toen',         sourceName: 'Ten Toen',          category: 'Shopping',  subcategory: 'Clothing',      needWant: 'Need', priority: 0 },

  // ── Health ────────────────────────────────────────────────────────────────
  { keyword: 'shoppers drug',       sourceName: 'Shoppers Drug Mart', category: 'Health',   subcategory: 'Pharmacy',      needWant: 'Need', priority: 0 },
  { keyword: 'rexall',              sourceName: 'Rexall',            category: 'Health',    subcategory: 'Pharmacy',      needWant: 'Need', priority: 0 },
  { keyword: 'zenni optical',       sourceName: 'Zenni Optical',     category: 'Health',    subcategory: 'Vision',        needWant: 'Need', priority: 0 },
  { keyword: 'belair',              sourceName: 'Belair Insurance',  category: 'Finance',   subcategory: 'Insurance',     needWant: 'Need', priority: 0 },

  // ── Entertainment ─────────────────────────────────────────────────────────
  { keyword: 'steamgames',          sourceName: 'Steam',             category: 'Entertainment', subcategory: 'Gaming',    needWant: 'Want', priority: 0 },
  { keyword: 'steam purchase',      sourceName: 'Steam',             category: 'Entertainment', subcategory: 'Gaming',    needWant: 'Want', priority: 1 },
  { keyword: 'netflix',             sourceName: 'Netflix',           category: 'Subscriptions', subcategory: 'Media',     needWant: 'Want', priority: 0 },
  { keyword: 'spotify',             sourceName: 'Spotify',           category: 'Subscriptions', subcategory: 'Media',     needWant: 'Want', priority: 0 },
  { keyword: 'google',              sourceName: 'Google',            category: 'Subscriptions', subcategory: 'Software',  needWant: 'Want', priority: 0 },
  { keyword: 'apple.com/bill',      sourceName: 'Apple',             category: 'Subscriptions', subcategory: 'Software',  needWant: 'Want', priority: 0 },
  { keyword: 'toronto blue jays',   sourceName: 'Toronto Blue Jays', category: 'Entertainment', subcategory: 'Events',    needWant: 'Want', priority: 0 },
  { keyword: 'stm monk sin',        sourceName: 'Montreal Metro',    category: 'Transport', subcategory: 'Transit',       needWant: 'Need', priority: 0 },

  // ── Housing & Finance ─────────────────────────────────────────────────────
  { keyword: 'monthly account fee', sourceName: 'Bank Fee',          category: 'Finance',   subcategory: 'Bank Fees',     needWant: 'Need', priority: 5 },
  { keyword: 'airbnb',              sourceName: 'Airbnb',            category: 'Travel',    subcategory: 'Accommodation', needWant: 'Want', priority: 0 },

  // ── Investments ───────────────────────────────────────────────────────────
  { keyword: 'questrade',           sourceName: 'Questrade',         category: 'Finance',   subcategory: 'Insurance',     needWant: 'NA',  priority: 5 },
  { keyword: 'marathon-photos',     sourceName: 'Marathon Photos',   category: 'Shopping',  subcategory: 'Other',         needWant: 'Want', priority: 0 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCategoryId(name: string, parentName?: string): Promise<string | null> {
  if (!name) return null;

  if (parentName) {
    const parent = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(isNull(categories.userId), isNull(categories.parentId), eq(categories.name, parentName)))
      .limit(1);

    if (parent.length === 0) {
      console.warn(`  ⚠ Parent category not found: "${parentName}"`);
      return null;
    }

    const sub = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(isNull(categories.userId), eq(categories.parentId, parent[0].id), eq(categories.name, name)))
      .limit(1);

    if (sub.length === 0) {
      console.warn(`  ⚠ Subcategory not found: "${name}" under "${parentName}"`);
      return null;
    }
    return sub[0].id;
  }

  const result = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(isNull(categories.userId), isNull(categories.parentId), eq(categories.name, name)))
    .limit(1);

  if (result.length === 0) {
    console.warn(`  ⚠ Category not found: "${name}"`);
    return null;
  }
  return result[0].id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding categorization rules...');
  let inserted = 0;
  let skipped = 0;

  for (const rule of RULES) {
    const categoryId = rule.category
      ? await getCategoryId(rule.category)
      : null;

    const subcategoryId = rule.subcategory && rule.category
      ? await getCategoryId(rule.subcategory, rule.category)
      : null;

    const existing = await db
      .select({ id: categorizationRules.id })
      .from(categorizationRules)
      .where(
        and(
          isNull(categorizationRules.userId),
          eq(categorizationRules.keyword, rule.keyword)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(categorizationRules).values({
      userId: null,
      keyword: rule.keyword,
      sourceName: rule.sourceName,
      categoryId,
      subcategoryId,
      needWant: rule.needWant,
      priority: rule.priority,
    });

    inserted++;
  }

  console.log(`Done. Inserted: ${inserted}, Skipped (already exist): ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Rules seed failed:', err);
  process.exit(1);
});
