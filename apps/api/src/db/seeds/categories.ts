import { and, eq, isNull } from 'drizzle-orm';
import { categories } from '../schema';
import { db } from '../index';

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
