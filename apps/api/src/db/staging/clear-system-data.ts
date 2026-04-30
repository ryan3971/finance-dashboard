/* eslint-disable no-console */
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  anticipatedBudget,
  categories,
  categorizationRules,
} from '@/db/schema';

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function clearStagingSystemData(): Promise<void> {
  // 1. Delete system-level rules first — they FK into system categories.
  const { rowCount: rulesDeleted } = await db
    .delete(categorizationRules)
    .where(isNull(categorizationRules.userId));

  console.log(`Deleted ${rulesDeleted ?? 0} system rule(s)`);

  // 2. Collect system category IDs before deleting them.
  //    anticipated_budget.categoryId may reference these rows (no cascade defined),
  //    so null those references out before the delete.
  const systemCategoryRows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(isNull(categories.userId));

  if (systemCategoryRows.length > 0) {
    const systemCategoryIds = systemCategoryRows.map((r) => r.id);

    const { rowCount: budgetNulled } = await db
      .update(anticipatedBudget)
      .set({ categoryId: null })
      .where(inArray(anticipatedBudget.categoryId, systemCategoryIds));

    if (budgetNulled && budgetNulled > 0) {
      console.log(
        `Nulled categoryId on ${budgetNulled} anticipated_budget row(s)`
      );
    }

    // 3. Delete system categories (parents and subcategories).
    //    Subcategory rows reference parent rows via parentId FK — Postgres resolves
    //    this within the same delete because there is no self-referential cascade;
    //    deleting by the collected ID set removes both in one statement.
    const { rowCount: catsDeleted } = await db
      .delete(categories)
      .where(inArray(categories.id, systemCategoryIds));

    console.log(`Deleted ${catsDeleted ?? 0} system category row(s)`);
  } else {
    console.log('No system categories found — nothing to delete');
  }
}

async function main() {
  await clearStagingSystemData();
  process.exit(0);
}

main().catch((err) => {
  console.error('Staging system clear failed:', err);
  process.exit(1);
});
