import { and, eq, isNull } from 'drizzle-orm';
import { categories } from '../schema';
import { db } from '../index';
import type { DbTransaction } from '../index';

const SYSTEM_CATEGORIES = [
  {
    name: 'Food',
    isIncome: false,
    icon: '🍔',
    subcategories: [
      'Groceries',
      'Eating Out',
      'Coffee',
      'Alcohol',
      'Delivery',
    ],
  },
  {
    name: 'Transport',
    isIncome: false,
    icon: '🚗',
    subcategories: [
      'Gas',
      'Parking',
      'Transit',
      'Rideshare',
      'Flight',
      'Car Maintenance',
    ],
  },
  {
    name: 'Shopping',
    isIncome: false,
    icon: '🛍️',
    subcategories: [
      'Clothing',
      'Online Retail',
      'Electronics',
      'Other',
    ],
  },
  {
    name: 'Health',
    isIncome: false,
    icon: '💊',
    subcategories: [
      'Pharmacy',
      'Medical',
      'Dental',
      'Vision',
      'Fitness',
      'Supplements',
    ],
  },
  {
    name: 'Entertainment',
    isIncome: false,
    icon: '🎮',
    subcategories: [
      'Gaming',
      'Streaming',
      'Events',
      'Sports',
      'Books',
    ],
  },
  {
    name: 'Housing',
    isIncome: false,
    icon: '🏠',
    subcategories: [
      'Rent',
      'Utilities',
      'Internet',
      'Furniture',
      'Repairs',
    ],
  },
  {
    name: 'Personal',
    isIncome: false,
    icon: '✂️',
    subcategories: ['Hair', 'Personal Care', 'Clothing'],
  },
  {
    name: 'Travel',
    isIncome: false,
    icon: '✈️',
    subcategories: [
      'Accommodation',
      'Flight',
      'Activities',
      'Food',
    ],
  },
  {
    name: 'Subscriptions',
    isIncome: false,
    icon: '🔁',
    subcategories: ['Software', 'Media', 'Services'],
  },
  {
    name: 'Education',
    isIncome: false,
    icon: '📚',
    subcategories: ['Courses', 'Books', 'Supplies'],
  },
  {
    name: 'Finance',
    isIncome: false,
    icon: '💳',
    subcategories: [
      'Bank Fees',
      'Credit Card Payment',
      'Insurance',
      'Debt',
    ],
  },
  {
    name: 'Gifts',
    isIncome: false,
    icon: '🎁',
    subcategories: ['Gifts', 'Donations'],
  },
  {
    name: 'Miscellaneous',
    isIncome: false,
    icon: '📦',
    subcategories: ['Other'],
  },
  {
    name: 'Uncategorized',
    isIncome: false,
    icon: '❓',
    subcategories: [],
  },
  {
    name: 'Salary',
    isIncome: true,
    icon: '💰',
    subcategories: ['Paycheque', 'Bonus', 'Severance'],
  },
  {
    name: 'Government',
    isIncome: true,
    icon: '🏛️',
    subcategories: ['Tax Refund', 'Benefits', 'EI', 'GST'],
  },
  {
    name: 'Investments',
    isIncome: true,
    icon: '📈',
    subcategories: ['Dividends', 'Capital Gains'],
  },
  {
    name: 'Other Income',
    isIncome: true,
    icon: '💵',
    subcategories: ['Gift', 'Reimbursement', 'Misc'],
  },
  {
    name: 'Transfer',
    isIncome: false,
    icon: '↔️',
    subcategories: [
      'Personal Transfer',
      'Credit Card Payment',
      'Investment Contribution',
    ],
  },
];

export async function seedSystemCategories(): Promise<void> {
  console.log('Seeding system categories...');

  for (const cat of SYSTEM_CATEGORIES) {
    const existing = await db
      .select()
      .from(categories)
      .where(
        and(
          isNull(categories.userId),
          isNull(categories.parentId),
          eq(categories.name, cat.name)
        )
      )
      .limit(1);

    let parentId: string;

    if (existing.length === 0) {
      const [inserted] = await db
        .insert(categories)
        .values({
          userId: null,
          name: cat.name,
          parentId: null,
          isIncome: cat.isIncome,
          icon: cat.icon,
        })
        .returning({ id: categories.id });
      parentId = inserted.id;
    } else {
      parentId = existing[0].id;
    }

    for (const subName of cat.subcategories) {
      const existingSub = await db
        .select()
        .from(categories)
        .where(
          and(
            isNull(categories.userId),
            eq(categories.parentId, parentId),
            eq(categories.name, subName)
          )
        )
        .limit(1);

      if (existingSub.length === 0) {
        await db.insert(categories).values({
          userId: null,
          name: subName,
          parentId,
          isIncome: cat.isIncome,
          icon: null,
        });
      }
    }
  }

  console.log('System categories seeded.');
}

/**
 * Copy the system category tree (userId = null) to a specific user.
 * Call this within the registration transaction so a failed seed rolls back
 * the user insert as well.
 */
export async function seedUserCategories(
  userId: string,
  tx: typeof db | DbTransaction
): Promise<void> {
  // Fetch all system categories in one query — avoid N+1
  const systemCategories = await tx
    .select({
      id: categories.id,
      name: categories.name,
      isIncome: categories.isIncome,
      icon: categories.icon,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(isNull(categories.userId));

  const topLevel = systemCategories.filter((c) => c.parentId === null);
  const subs = systemCategories.filter(
    (c): c is typeof c & { parentId: string } => c.parentId !== null
  );

  // Map old system ID → new user-owned ID
  const idMap = new Map<string, string>();

  if (topLevel.length > 0) {
    const inserted = await tx
      .insert(categories)
      .values(
        topLevel.map((c) => ({
          userId,
          name: c.name,
          isIncome: c.isIncome,
          icon: c.icon,
          parentId: null,
        }))
      )
      .returning({ id: categories.id, name: categories.name });

    // Match by name to build the id map (names are unique among top-level system cats)
    for (const row of inserted) {
      const original = topLevel.find((c) => c.name === row.name);
      if (original) idMap.set(original.id, row.id);
    }
  }

  if (subs.length > 0) {
    await tx.insert(categories).values(
      subs.map((c) => ({
        userId,
        name: c.name,
        isIncome: c.isIncome,
        icon: c.icon,
        // remap to the user's copy of the parent
        parentId: idMap.get(c.parentId) ?? c.parentId,
      }))
    );
  }
}
