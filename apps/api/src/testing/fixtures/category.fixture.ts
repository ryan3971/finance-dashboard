import { categories } from '@/db/schema';
import { assertDefined } from '@/lib/assert';
import { db } from '@/db';

interface CategoryRow {
  id: string;
  userId: string | null;
  name: string;
  parentId: string | null;
  isIncome: boolean;
  icon: string | null;
  createdAt: Date;
}

/**
 * Insert a category row and return the full inserted record.
 *
 * Defaults to a user-owned expense category with no parent and no icon.
 * Pass `userId: null` to create a system-level category.
 * Pass `parentId` to create a subcategory — the caller is responsible for
 * ensuring the parent exists before calling this factory.
 *
 * Usage:
 *   const cat   = await categoryFixture({ userId: user.id, name: 'Groceries' });
 *   const sub   = await categoryFixture({ userId: user.id, name: 'Supermarket', parentId: cat.id });
 *   const sys   = await categoryFixture({ userId: null, name: 'System Cat' });
 */
export async function categoryFixture(
  overrides: Partial<CategoryRow> = {}
): Promise<CategoryRow> {
  const [row] = await db
    .insert(categories)
    .values({
      userId: null,
      name: 'Test Category',
      isIncome: false,
      parentId: null,
      icon: null,
      ...overrides,
    })
    .returning();
  assertDefined(row, 'Expected category insert to return a row');
  return row;
}
